import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  Bytes,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import api from "./api";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

// private
// -----------------------------------------------------------------------------

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch (error: any) {
  console.warn(
    `Error JSON parsing firebase config. Supplied value: ${
      import.meta.env.VITE_APP_FIREBASE_CONFIG
    }`,
  );
  FIREBASE_CONFIG = {};
}

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestore> | null = null;
let firebaseStorage: ReturnType<typeof getStorage> | null = null;

const _initializeFirebase = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }
  return firebaseApp;
};

const _getFirestore = () => {
  if (!firestore) {
    firestore = getFirestore(_initializeFirebase());
  }
  return firestore;
};

const _getStorage = () => {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(_initializeFirebase());
  }
  return firebaseStorage;
};

// -----------------------------------------------------------------------------

export const loadFirebaseStorage = async () => {
  return _getStorage();
};

type FirebaseStoredScene = {
  sceneVersion: number;
  iv: Bytes;
  ciphertext: Bytes;
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: { iv: Uint8Array; ciphertext: Uint8Array },
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext as Uint8Array<ArrayBuffer>;
  const iv = data.iv as Uint8Array<ArrayBuffer>;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

const fromFirestoreScene = (scene: FirebaseStoredScene) => ({
  iv: scene.iv.toUint8Array(),
  ciphertext: scene.ciphertext.toUint8Array(),
});

// Self-hosted: rooms and their files are stored by our API instead of Firebase
// (still end-to-end encrypted with the room key; the server only sees ciphertext)
// -----------------------------------------------------------------------------

const IS_SELF_HOSTED = import.meta.env.VITE_APP_SELF_HOSTED === "true";
// save uses "/files/rooms/<id>", load "files/rooms/<id>"
const COLLAB_FILES_PREFIX_RE = /files\/rooms\/([^/]+)$/;
const MAX_SAVE_ATTEMPTS = 5;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

const decryptServerRoom = (
  room: { iv: string; ciphertext: string },
  roomKey: string,
) =>
  decryptElements(
    { iv: fromBase64(room.iv), ciphertext: fromBase64(room.ciphertext) },
    roomKey,
  );

/** Same contract as the Firestore transaction: reconcile with what's stored, retry on conflict. */
const saveRoomToServer = async (
  roomId: string,
  roomKey: string,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const stored = await api.getCollabRoom(roomId);
    const toStore = stored
      ? getSyncableElements(
          reconcileElements(
            elements,
            getSyncableElements(
              restoreElements(await decryptServerRoom(stored, roomKey), null),
            ) as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
            appState,
          ),
        )
      : [...elements];
    const { ciphertext, iv } = await encryptElements(roomKey, toStore);
    const res = await api.saveCollabRoom(roomId, {
      sceneVersion: getSceneVersion(toStore),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      iv: toBase64(iv),
      baseRevision: stored?.revision ?? null,
    });
    if (!res.conflict) {
      return toStore;
    }
  }
  throw new Error("Too many concurrent saves to this collaboration room");
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return FirebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  if (IS_SELF_HOSTED) {
    return saveFilesToServer(prefix, files);
  }
  const storage = await loadFirebaseStorage();

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const storageRef = ref(storage, `${prefix}/${id}`);
        await uploadBytes(storageRef, buffer, {
          cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const saveFilesToServer = async (
  prefix: string,
  files: { id: FileId; buffer: Uint8Array }[],
) => {
  const roomId = prefix.match(COLLAB_FILES_PREFIX_RE)?.[1];
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];
  // one request per file keeps each JSON body small
  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        if (!roomId) {
          throw new Error(`Unsupported file prefix: ${prefix}`);
        }
        const res = await api.saveCollabFiles(roomId, [
          { id, data: toBase64(buffer) },
        ]);
        (res.savedFiles.includes(id) ? savedFiles : erroredFiles).push(id);
      } catch (error: any) {
        console.error(error);
        erroredFiles.push(id);
      }
    }),
  );
  return { savedFiles, erroredFiles };
};

const createFirebaseSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: Bytes.fromUint8Array(iv),
  } as FirebaseStoredScene;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToFirebase(portal, elements)
  ) {
    return null;
  }

  if (IS_SELF_HOSTED) {
    const storedElements = await saveRoomToServer(
      roomId,
      roomKey,
      elements,
      appState,
    );
    FirebaseSceneVersionCache.set(socket, storedElements);
    return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
  }

  const firestore = _getFirestore();
  const docRef = doc(firestore, "scenes", roomId);

  const storedScene = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists()) {
      const storedScene = await createFirebaseSceneDocument(elements, roomKey);

      transaction.set(docRef, storedScene);

      return storedScene;
    }

    const prevStoredScene = snapshot.data() as FirebaseStoredScene;
    const prevStoredElements = getSyncableElements(
      restoreElements(
        await decryptElements(fromFirestoreScene(prevStoredScene), roomKey),
        null,
      ),
    );
    const reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );

    const storedScene = await createFirebaseSceneDocument(
      reconciledElements,
      roomKey,
    );

    transaction.update(docRef, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const storedElements = getSyncableElements(
    restoreElements(
      await decryptElements(fromFirestoreScene(storedScene), roomKey),
      null,
    ),
  );

  FirebaseSceneVersionCache.set(socket, storedElements);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  if (IS_SELF_HOSTED) {
    const stored = await api.getCollabRoom(roomId);
    if (!stored) {
      return null;
    }
    const elements = getSyncableElements(
      restoreElements(await decryptServerRoom(stored, roomKey), null, {
        deleteInvisibleElements: true,
      }),
    );
    if (socket) {
      FirebaseSceneVersionCache.set(socket, elements);
    }
    return elements;
  }
  const firestore = _getFirestore();
  const docRef = doc(firestore, "scenes", roomId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  const storedScene = docSnap.data() as FirebaseStoredScene;
  const elements = getSyncableElements(
    restoreElements(
      await decryptElements(fromFirestoreScene(storedScene), roomKey),
      null,
      { deleteInvisibleElements: true },
    ),
  );

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements);
  }

  return elements;
};

/** Encrypted file bytes from Firebase Storage, or our API when self-hosted */
const fetchFileBytes = async (
  prefix: string,
  id: FileId,
): Promise<ArrayBuffer | null> => {
  if (IS_SELF_HOSTED) {
    const roomId = prefix.match(COLLAB_FILES_PREFIX_RE)?.[1];
    const bytes = roomId ? await api.getCollabFile(roomId, id) : null;
    return bytes ? (bytes.buffer as ArrayBuffer) : null;
  }
  const url = `https://firebasestorage.googleapis.com/v0/b/${
    FIREBASE_CONFIG.storageBucket
  }/o/${encodeURIComponent(prefix.replace(/^\//, ""))}%2F${id}`;
  const response = await fetch(`${url}?alt=media`);
  return response.status < 400 ? response.arrayBuffer() : null;
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const arrayBuffer = await fetchFileBytes(prefix, id);
        if (arrayBuffer) {
          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
