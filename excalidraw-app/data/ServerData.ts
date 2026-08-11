import api from "./api";

const SAVE_DEBOUNCE_MS = 2000;

export class ServerData {
  private currentSceneId: string | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isSaving = false;

  setCurrentSceneId(id: string | null) {
    this.currentSceneId = id;
  }

  getCurrentSceneId(): string | null {
    return this.currentSceneId;
  }

  async save(
    elements: any[],
    appState: any,
    title?: string,
  ): Promise<string | null> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    return new Promise((resolve) => {
      this.saveTimeout = setTimeout(async () => {
        try {
          this.isSaving = true;

          if (this.currentSceneId) {
            await api.updateScene(this.currentSceneId, {
              elements,
              appState: this.sanitizeAppState(appState),
              title,
            });
            resolve(this.currentSceneId);
          } else {
            const res = await api.createScene({
              title: title || "Untitled",
              elements,
              appState: this.sanitizeAppState(appState),
            });
            this.currentSceneId = res.scene.id;
            resolve(res.scene.id);
          }
        } catch (err) {
          console.error("Server save failed:", err);
          resolve(null);
        } finally {
          this.isSaving = false;
        }
      }, SAVE_DEBOUNCE_MS);
    });
  }

  async saveImmediate(
    elements: any[],
    appState: any,
    title?: string,
  ): Promise<string | null> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      this.isSaving = true;

      if (this.currentSceneId) {
        await api.updateScene(this.currentSceneId, {
          elements,
          appState: this.sanitizeAppState(appState),
          title,
        });
        return this.currentSceneId;
      }
      const res = await api.createScene({
        title: title || "Untitled",
        elements,
        appState: this.sanitizeAppState(appState),
      });
      this.currentSceneId = res.scene.id;
      return res.scene.id;
    } catch (err) {
      console.error("Server save failed:", err);
      return null;
    } finally {
      this.isSaving = false;
    }
  }

  async load(sceneId: string) {
    try {
      const res = await api.getScene(sceneId);
      this.currentSceneId = sceneId;
      return {
        elements: res.scene.elements || [],
        appState: res.scene.app_state || {},
        title: res.scene.title,
      };
    } catch (err) {
      console.error("Server load failed:", err);
      return null;
    }
  }

  async listScenes() {
    try {
      const res = await api.listScenes();
      return res.scenes;
    } catch (err) {
      console.error("List scenes failed:", err);
      return [];
    }
  }

  async deleteScene(id: string) {
    try {
      await api.deleteScene(id);
      if (this.currentSceneId === id) {
        this.currentSceneId = null;
      }
      return true;
    } catch (err) {
      console.error("Delete scene failed:", err);
      return false;
    }
  }

  async newScene() {
    this.currentSceneId = null;
  }

  async uploadFile(file: File, fileId?: string) {
    try {
      const res = await api.uploadFile(
        file,
        this.currentSceneId || undefined,
        fileId,
      );
      return res;
    } catch (err) {
      console.error("File upload failed:", err);
      return null;
    }
  }

  getFileUrl(fileId: string): string {
    return api.getFileUrl(fileId);
  }

  isCurrentlySaving(): boolean {
    return this.isSaving;
  }

  flushSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  private sanitizeAppState(appState: any): any {
    // Remove non-serializable or unnecessary fields
    const {
      collaborators,
      selectedElementIds,
      editingElement,
      editingLinearElement,
      ...rest
    } = appState || {};
    return rest;
  }
}

export const serverData = new ServerData();
export default serverData;
