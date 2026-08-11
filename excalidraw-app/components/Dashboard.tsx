import { useState, useEffect, useCallback } from "react";

import api from "../data/api";
import { useAuth } from "../auth/AuthContext";

import { SceneCard } from "./SceneCard";

interface Scene {
  id: string;
  title: string;
  version: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  owner_name: string;
}

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Dashboard() {
  const { user, logout } = useAuth();
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

  const handleOpenScene = (id: string) => {
    navigateTo(`/s/${id}`);
  };

  const handleNewScene = () => {
    localStorage.removeItem("excalidraw-last-scene-id");
    navigateTo("/s/new");
  };

  const handleDelete = async (id: string) => {
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

  const handleShare = async (id: string) => {
    try {
      const res = await api.shareScene(id);
      const url = `${window.location.origin}/#json=${res.scene.share_token}`;
      await navigator.clipboard.writeText(url);
      alert("Share link copied to clipboard!");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s)),
    );
  };

  const sortedScenes = [...scenes].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Left Sidebar */}
      <aside
        style={{
          width: "220px",
          minWidth: "220px",
          background: "#f9fafb",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          padding: "16px 0",
        }}
      >
        {/* User */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "0 16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              flexShrink: 0,
            }}
          >
            {(user?.name || user?.email || "U")[0].toUpperCase()}
          </div>
          <div
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "13px",
              fontWeight: 600,
              color: "#111827",
            }}
          >
            {user?.name || user?.email}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <SidebarItem icon="grid" label="Dashboard" active />
          <SidebarItem icon="users" label="Team members" />
        </nav>

        {/* Collections */}
        <div style={{ marginTop: "24px", padding: "0 16px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#6366f1",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "8px",
            }}
          >
            Collections
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 0",
              fontSize: "13px",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "14px" }}>🔒</span> Private
          </div>
        </div>

        {/* Bottom user + logout */}
        <div style={{ marginTop: "auto", padding: "0 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 0",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "11px",
                flexShrink: 0,
              }}
            >
              {(user?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.name || user?.email}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                color: "#9ca3af",
                padding: "4px",
              }}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: "auto", background: "#fff" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 32px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Dashboard
            </h1>
            <p
              style={{ margin: "4px 0 0", fontSize: "13px", color: "#9ca3af" }}
            >
              Tip: Press Alt+A to create a scene instantly.
            </p>
          </div>
          <button
            onClick={handleNewScene}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#6366f1",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✏</span> Start drawing
          </button>
        </div>

        {error && (
          <div
            style={{
              margin: "16px 32px 0",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ padding: "24px 32px" }}>
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "#9ca3af",
              }}
            >
              Loading...
            </div>
          ) : scenes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎨</div>
              <h3 style={{ margin: "0 0 8px", color: "#374151" }}>
                No drawings yet
              </h3>
              <p
                style={{
                  margin: "0 0 20px",
                  color: "#9ca3af",
                  fontSize: "14px",
                }}
              >
                Click "Start drawing" to create your first scene.
              </p>
              <button
                onClick={handleNewScene}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Start drawing
              </button>
            </div>
          ) : (
            <>
              {/* Recently modified */}
              <Section title="Recently modified by you">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {sortedScenes.slice(0, 6).map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      onOpen={handleOpenScene}
                      onDelete={handleDelete}
                      onShare={handleShare}
                      onRename={handleRename}
                    />
                  ))}
                </div>
              </Section>

              {/* All scenes */}
              {sortedScenes.length > 6 && (
                <Section title="All drawings">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    {sortedScenes.slice(6).map((scene) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        onOpen={handleOpenScene}
                        onDelete={handleDelete}
                        onShare={handleShare}
                        onRename={handleRename}
                      />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  const icons: Record<string, string> = {
    grid: "▦",
    users: "♟",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        color: active ? "#6366f1" : "#374151",
        background: active ? "#eef2ff" : "transparent",
        borderRadius: "6px",
        margin: "0 8px",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: "15px" }}>{icons[icon]}</span>
      {label}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "16px",
          fontWeight: 700,
          color: "#6366f1",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
