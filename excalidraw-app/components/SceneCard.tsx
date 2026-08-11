import { useState, useRef, useEffect } from "react";

import api from "../data/api";

interface Scene {
  id: string;
  title: string;
  version: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  owner_name: string;
}

function formatDate(dateStr: string) {
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
}

export function SceneCard({
  scene,
  onOpen,
  onDelete,
  onShare,
  onRename,
}: {
  scene: Scene;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editValue, setEditValue] = useState(scene.title || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const handleSubmit = async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== scene.title) {
      try {
        await api.renameScene(scene.id, trimmed);
        onRename(scene.id, trimmed);
      } catch {
        setEditValue(scene.title);
      }
    } else {
      setEditValue(scene.title);
    }
    setRenaming(false);
  };

  return (
    <div
      onClick={() => !renaming && onOpen(scene.id)}
      style={{
        borderRadius: "10px",
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: renaming ? "default" : "pointer",
        overflow: "hidden",
        transition: "box-shadow 0.15s, transform 0.15s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        if (!renaming) {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Thumbnail placeholder */}
      <div
        style={{
          height: "160px",
          background:
            "linear-gradient(135deg, #e0e7ff 0%, #f0e6ff 50%, #fce7f3 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a5b4fc"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>

        {/* 3-dot menu */}
        <div
          style={{ position: "absolute", top: "8px", right: "8px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              background: "rgba(255,255,255,0.8)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#6b7280",
              backdropFilter: "blur(4px)",
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: "140px",
                zIndex: 10,
                overflow: "hidden",
              }}
            >
              <MenuButton
                label="Rename"
                onClick={() => {
                  setRenaming(true);
                  setMenuOpen(false);
                }}
              />
              <MenuButton
                label="Share"
                onClick={() => {
                  onShare(scene.id);
                  setMenuOpen(false);
                }}
              />
              <MenuButton
                label="Delete"
                color="#dc2626"
                hoverBg="#fef2f2"
                onClick={() => {
                  onDelete(scene.id);
                  setMenuOpen(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Timestamp badge */}
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
          }}
        >
          {formatDate(scene.updated_at)}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditValue(scene.title);
                  setRenaming(false);
                }
              }}
              style={{
                width: "100%",
                padding: "2px 4px",
                border: "1px solid #6366f1",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#111827",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </form>
        ) : (
          <div
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "#111827",
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {scene.title || "Untitled"}
          </div>
        )}
        <div style={{ fontSize: "12px", color: "#9ca3af" }}>
          by {scene.owner_name || "Unknown"}
        </div>
      </div>
    </div>
  );
}

function MenuButton({
  label,
  color = "#374151",
  hoverBg = "#f3f4f6",
  onClick,
}: {
  label: string;
  color?: string;
  hoverBg?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 12px",
        border: "none",
        background: "transparent",
        color,
        cursor: "pointer",
        textAlign: "left",
        fontSize: "13px",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {label}
    </button>
  );
}
