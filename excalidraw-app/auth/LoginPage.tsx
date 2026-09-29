import { useState } from "react";

import { KeyIcon } from "../components/dashboard/icons";
import { Button, ErrorBanner } from "../components/dashboard/ui";

import { AuthField, AuthLayout, AuthLink } from "./AuthLayout";

import type { FormEvent } from "react";

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

  const shownError = localError || error || "";

  if (mfaToken) {
    return (
      <AuthLayout
        title="Two-factor authentication"
        subtitle={
          useRecoveryCode
            ? "Enter one of your recovery codes."
            : "Enter the 6-digit code from your authenticator app."
        }
      >
        <ErrorBanner message={shownError} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthField
            label={useRecoveryCode ? "Recovery code" : "Authentication code"}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="one-time-code"
            inputMode={useRecoveryCode ? "text" : "numeric"}
            placeholder={useRecoveryCode ? "xxxxx-xxxxx" : "123456"}
            className="text-center font-mono tracking-[0.2em]"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full py-2.5"
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>
        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          <AuthLink
            onClick={() => {
              setUseRecoveryCode(!useRecoveryCode);
              setCode("");
              setLocalError("");
            }}
          >
            {useRecoveryCode
              ? "Use your authenticator app instead"
              : "Use a recovery code instead"}
          </AuthLink>
          <AuthLink
            muted
            onClick={() => {
              setMfaToken(null);
              setCode("");
              setLocalError("");
            }}
          >
            Back to sign in
          </AuthLink>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <AuthLink onClick={onSwitchToRegister}>Create one</AuthLink>
        </>
      }
    >
      <ErrorBanner message={shownError} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="username webauthn"
          placeholder="name@company.com"
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="mt-1 w-full py-2.5"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <Button
        disabled={loading}
        onClick={() => run(onPasskeyLogin)}
        className="w-full py-2.5"
      >
        <KeyIcon />
        Sign in with a passkey
      </Button>
    </AuthLayout>
  );
}
