import { useState } from "react";

import type { CSSProperties, FormEvent } from "react";

interface LoginPageProps {
  /** resolves an MFA token when a second factor is required */
  onLogin: (email: string, password: string) => Promise<string | null>;
  onVerifyMfa: (
    mfaToken: string,
    second: { code: string } | { recoveryCode: string },
  ) => Promise<void>;
  onPasskeyLogin: () => Promise<void>;
  onSwitchToRegister: () => void;
  error?: string;
}

export function LoginPage({
  onLogin,
  onVerifyMfa,
  onPasskeyLogin,
  onSwitchToRegister,
  error,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    setLocalError("");
    try {
      await action();
    } catch (err: any) {
      // closing the browser's passkey dialog isn't an error worth showing
      if (err?.name !== "NotAllowedError") {
        setLocalError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mfaToken) {
        await onVerifyMfa(
          mfaToken,
          useRecoveryCode ? { recoveryCode: code } : { code },
        );
        return;
      }
      const token = await onLogin(email, password);
      if (token) {
        setMfaToken(token);
      }
    });
  };

  const shownError = localError || error;

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Excalidraw Self-Hosted</h1>
        <p style={styles.subtitle}>
          {mfaToken
            ? useRecoveryCode
              ? "Enter one of your recovery codes"
              : "Enter the 6-digit code from your authenticator app"
            : "Sign in to your account"}
        </p>

        {shownError && <div style={styles.error}>{shownError}</div>}

        {mfaToken ? (
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="login-code" style={styles.label}>
                {useRecoveryCode ? "Recovery code" : "Authentication code"}
              </label>
              <input
                id="login-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
                inputMode={useRecoveryCode ? "text" : "numeric"}
                placeholder={useRecoveryCode ? "xxxxx-xxxxx" : "123456"}
                style={{ ...styles.input, letterSpacing: "0.15em" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={styles.primary(loading)}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode(!useRecoveryCode);
                setCode("");
                setLocalError("");
              }}
              style={styles.link}
            >
              {useRecoveryCode
                ? "Use your authenticator app instead"
                : "Use a recovery code instead"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaToken(null);
                setCode("");
                setLocalError("");
              }}
              style={styles.link}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="login-email" style={styles.label}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username webauthn"
                style={styles.input}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="login-password" style={styles.label}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={styles.primary(loading)}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              or
              <span style={styles.dividerLine} />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => run(onPasskeyLogin)}
              style={styles.secondary(loading)}
            >
              Sign in with a passkey
            </button>

            <p
              style={{
                textAlign: "center",
                marginTop: "1.25rem",
                fontSize: "0.85rem",
                opacity: 0.7,
              }}
            >
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={onSwitchToRegister}
                style={{
                  ...styles.link,
                  display: "inline",
                  margin: 0,
                  width: "auto",
                }}
              >
                Register
              </button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "var(--bg-primary, #1e1e1e)",
    color: "var(--text-primary, #fff)",
  } as CSSProperties,
  card: {
    padding: "2.5rem",
    borderRadius: "12px",
    background: "var(--bg-secondary, #2a2a2a)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
    width: "100%",
    maxWidth: "380px",
  } as CSSProperties,
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    marginBottom: "0.5rem",
    textAlign: "center",
  } as CSSProperties,
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
  } as CSSProperties,
  error: {
    padding: "0.75rem",
    marginBottom: "1rem",
    borderRadius: "6px",
    background: "rgba(220, 53, 69, 0.15)",
    color: "#dc3545",
    fontSize: "0.85rem",
  } as CSSProperties,
  label: {
    display: "block",
    marginBottom: "0.4rem",
    fontSize: "0.85rem",
    opacity: 0.8,
  } as CSSProperties,
  input: {
    width: "100%",
    padding: "0.7rem",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "inherit",
    fontSize: "0.95rem",
    boxSizing: "border-box",
  } as CSSProperties,
  primary: (loading: boolean): CSSProperties => ({
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
  }),
  secondary: (loading: boolean): CSSProperties => ({
    width: "100%",
    padding: "0.7rem",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "inherit",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
  }),
  link: {
    display: "block",
    width: "100%",
    marginTop: "0.9rem",
    background: "none",
    border: "none",
    color: "#8b8ff0",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "0.85rem",
  } as CSSProperties,
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    margin: "1.1rem 0",
    fontSize: "0.8rem",
    opacity: 0.6,
  } as CSSProperties,
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.15)",
  } as CSSProperties,
};
