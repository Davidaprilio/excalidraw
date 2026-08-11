import { useState, useEffect, useCallback } from "react";

import api from "../data/api";

import type { MouseEvent } from "react";

interface Scene {
  id: string;
  title: string;
  version: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  owner_name: string;
}

interface ScenesListProps {
  onOpenScene: (sceneId: string) => void;
  onNewScene: () => void;
  onClose: () => void;
}

export function ScenesList({
  onOpenScene,
  onNewScene,
  onClose,
}: ScenesListProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadScenes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listScenes();
      setScenes(res.scenes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  const handleDelete = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this drawing?")) {
      return;
    }
    try {
      await api.deleteScene(id);
      setScenes((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleShare = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.shareScene(id);
      const url = `${window.location.origin}/#json=${res.scene.share_token}`;
      await navigator.clipboard.writeText(url);
      alert("Share link copied to clipboard!");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) {
      return "Just now";
    }
    if (mins < 60) {
      return `${mins}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    if (days < 7) {
      return `${days}d ago`;
    }
    return d.toLocaleDateString();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-primary, #1e1e1e)",
          borderRadius: "12px",
          padding: "2rem",
          width: "90%",
          maxWidth: "700px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.3rem" }}>My Drawings</h2>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={onNewScene}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "none",
                background: "#5b5fc7",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              + New Drawing
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              borderRadius: "6px",
              background: "rgba(220, 53, 69, 0.15)",
              color: "#dc3545",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>
            Loading...
          </div>
        ) : scenes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>
            <p>No drawings yet.</p>
            <p style={{ fontSize: "0.85rem" }}>
              Create a new drawing or save your current work.
            </p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {scenes.map((scene) => (
              <div
                key={scene.id}
                onClick={() => onOpenScene(scene.id)}
                style={{
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.03)";
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {scene.title || "Untitled"}
                  </div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.5 }}>
                    Updated {formatDate(scene.updated_at)} &middot; v
                    {scene.version}
                    {scene.is_shared && " &middot; Shared"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={(e) => handleShare(scene.id, e)}
                    title="Share"
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "4px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                    }}
                  >
                    Share
                  </button>
                  <button
                    onClick={(e) => handleDelete(scene.id, e)}
                    title="Delete"
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "4px",
                      border: "1px solid rgba(220,53,69,0.3)",
                      background: "transparent",
                      color: "#dc3545",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
