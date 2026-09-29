import { useCallback, useEffect, useState } from "react";

import api from "../../../data/api";
import { Button, Modal, timeAgo, useToast, Card } from "../ui";

import type { Passkey, SecurityOverview } from "../../../data/api";
import type { FormEvent } from "react";

const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/** Account page right column: passkeys and two-factor authentication */
export function SecuritySection() {
  const toast = useToast();
  const [security, setSecurity] = useState<SecurityOverview | null>(null);

  const reload = useCallback(
    () =>
      api
        .getSecurity()
        .then(setSecurity)
        .catch((err) => toast(err.message)),
    [toast],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  if (!security) {
    return (
      <p className="text-sm text-gray-500">Loading security settings...</p>
    );
  }
  return (
    <>
      <PasskeysCard passkeys={security.passkeys} onChanged={reload} />
      <TwoFactorCard totp={security.totp} onChanged={reload} />
    </>
  );
}

// ---- Passkeys ----

const passkeysSupported = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential;

/** e.g. "Chrome on Linux", a default name for a new passkey */
const guessDeviceName = () => {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Mac OS/.test(ua)
    ? "macOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "";
  return os ? `${browser} on ${os}` : browser;
};

function PasskeysCard({
  passkeys,
  onChanged,
}: {
  passkeys: Passkey[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Passkey | null>(null);

  const add = async () => {
    setBusy(true);
    try {
      await api.registerPasskey(guessDeviceName());
      toast("Passkey added. You can now sign in with it.");
      onChanged();
    } catch (err: any) {
      // NotAllowedError: the user closed the browser dialog
      if (err?.name !== "NotAllowedError") {
        toast(
          err?.name === "InvalidStateError"
            ? "This device already has a passkey for your account"
            : err.message,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Passkeys"
      description="Sign in with your fingerprint, face, screen lock or a security key instead of a password."
    >
      {passkeys.length > 0 && (
        <div className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {passkeys.map((passkey) => (
            <div
              key={passkey.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {passkey.name}
                  {passkey.backed_up && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-500">
                      synced
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Added {timeAgo(passkey.created_at)}
                  {passkey.last_used_at
                    ? ` · last used ${timeAgo(passkey.last_used_at)}`
                    : " · never used"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setRenaming(passkey)}>
                Rename
              </Button>
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Remove "${passkey.name}"? You won't be able to sign in with it anymore.`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await api.deletePasskey(passkey.id);
                    toast("Passkey removed");
                    onChanged();
                  } catch (err: any) {
                    toast(err.message);
                  }
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      {passkeysSupported() ? (
        <Button variant="primary" disabled={busy} onClick={add}>
          Add a passkey
        </Button>
      ) : (
        <p className="text-sm text-gray-500">
          This browser doesn't support passkeys.
        </p>
      )}
      {renaming && (
        <Modal title="Rename passkey" onClose={() => setRenaming(null)}>
          <RenameForm
            initial={renaming.name}
            onCancel={() => setRenaming(null)}
            onSave={async (name) => {
              await api.renamePasskey(renaming.id, name);
              setRenaming(null);
              onChanged();
            }}
          />
        </Modal>
      )}
    </Card>
  );
}

function RenameForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) {
          onSave(name.trim());
        }
      }}
      className="flex flex-col gap-4"
    >
      <input
        autoFocus
        aria-label="Passkey name"
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        className={INPUT}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

// ---- Two-factor authentication (TOTP) ----

function TwoFactorCard({
  totp,
  onChanged,
}: {
  totp: SecurityOverview["totp"];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [passwordAction, setPasswordAction] = useState<
    "disable" | "regenerate" | null
  >(null);

  const startSetup = async () => {
    try {
      setSetup(await api.startTotpSetup());
      setCode("");
      setError("");
    } catch (err: any) {
      toast(err.message);
    }
  };

  const enable = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const res = await api.enableTotp(code.replace(/\s/g, ""));
      setSetup(null);
      setRecoveryCodes(res.recoveryCodes);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Card
      title="Two-factor authentication"
      description="Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy...) after your password."
    >
      {recoveryCodes ? (
        <RecoveryCodes
          codes={recoveryCodes}
          onDone={() => setRecoveryCodes(null)}
        />
      ) : totp.enabled ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            On since {new Date(totp.enabledAt!).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-500">
            {totp.recoveryCodesRemaining} of 10 recovery codes left.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPasswordAction("regenerate")}>
              New recovery codes
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setPasswordAction("disable")}
            >
              Turn off
            </Button>
          </div>
        </div>
      ) : setup ? (
        <form onSubmit={enable} className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-gray-600">
            <li>Scan this QR code with your authenticator app.</li>
            <li>Enter the 6-digit code it shows.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={setup.qr}
              alt="QR code for your authenticator app"
              className="h-44 w-44 rounded-lg border border-gray-200 bg-white p-1"
            />
            <div className="min-w-0 flex-1 text-xs text-gray-500">
              Can't scan it? Enter this key:
              <code className="mt-1 block rounded bg-gray-100 px-2 py-1.5 font-mono text-[13px] break-all text-gray-900 select-all">
                {setup.secret}
              </code>
            </div>
          </div>
          <input
            aria-label="Authentication code"
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={7}
            onChange={(event) => setCode(event.target.value)}
            className={`${INPUT} tracking-widest`}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={code.replace(/\s/g, "").length !== 6}
            >
              Turn on
            </Button>
            <Button onClick={() => setSetup(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="primary" onClick={startSetup}>
          Set up authenticator app
        </Button>
      )}

      {passwordAction && (
        <PasswordDialog
          title={
            passwordAction === "disable"
              ? "Turn off two-factor authentication"
              : "Generate new recovery codes"
          }
          description={
            passwordAction === "disable"
              ? "Signing in will only need your password (or a passkey)."
              : "Your current recovery codes will stop working."
          }
          confirmLabel={passwordAction === "disable" ? "Turn off" : "Generate"}
          onClose={() => setPasswordAction(null)}
          onConfirm={async (password) => {
            if (passwordAction === "disable") {
              await api.disableTotp(password);
              toast("Two-factor authentication turned off");
            } else {
              setRecoveryCodes(
                (await api.regenerateRecoveryCodes(password)).recoveryCodes,
              );
            }
            setPasswordAction(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function RecoveryCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const toast = useToast();
  const text = codes.join("\n");
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Save these recovery codes somewhere safe. Each one signs you in once if
        you lose your authenticator app. They won't be shown again.
      </p>
      <ul
        aria-label="Recovery codes"
        className="grid list-none grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-900"
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            navigator.clipboard
              .writeText(text)
              .then(() => toast("Recovery codes copied"))
              .catch(() => toast("Couldn't copy, please select them manually"))
          }
        >
          Copy
        </Button>
        <Button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([`Excalidraw Plus recovery codes\n\n${text}\n`], {
                type: "text/plain",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "excalidraw-recovery-codes.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download
        </Button>
        <Button variant="primary" onClick={onDone}>
          I've saved them
        </Button>
      </div>
    </div>
  );
}

function PasswordDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onConfirm(password);
          } catch (err: any) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <p className="text-sm text-gray-600">{description}</p>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Confirm with your password
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={INPUT}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!password || busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
