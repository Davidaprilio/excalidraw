import { useState } from "react";

import type { FormEvent } from "react";

interface RegisterPageProps {
  onRegister: (email: string, password: string, name?: string) => Promise<void>;
  onSwitchToLogin: () => void;
  error?: string;
}

export function RegisterPage({
  onRegister,
  onSwitchToLogin,
  error,
}: RegisterPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLocalError("");
    try {
      await onRegister(email, password, name || undefined);
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "var(--bg-primary, #1e1e1e)",
        color: "var(--text-primary, #fff)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "2.5rem",
          borderRadius: "12px",
          background: "var(--bg-secondary, #2a2a2a)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          width: "100%",
          maxWidth: "380px",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            textAlign: "center",
          }}
        >
          Excalidraw Self-Hosted
        </h1>
        <p
          style={{
            textAlign: "center",
            opacity: 0.7,
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          Create your account
        </p>

        {(error || localError) && (
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
            {error || localError}
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontSize: "0.85rem",
              opacity: 0.8,
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
            style={{
              width: "100%",
              padding: "0.7rem",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "inherit",
              fontSize: "0.95rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontSize: "0.85rem",
              opacity: 0.8,
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.7rem",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "inherit",
              fontSize: "0.95rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontSize: "0.85rem",
              opacity: 0.8,
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: "100%",
              padding: "0.7rem",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "inherit",
              fontSize: "0.95rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "6px",
            border: "none",
            background: "#5b5fc7",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: "1.25rem",
            fontSize: "0.85rem",
            opacity: 0.7,
          }}
        >
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: "none",
              border: "none",
              color: "#5b5fc7",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "0.85rem",
            }}
          >
            Sign In
          </button>
        </p>
      </form>
    </div>
  );
}
