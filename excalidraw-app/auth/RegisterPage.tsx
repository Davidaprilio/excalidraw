import { useState } from "react";

import { Button, ErrorBanner } from "../components/dashboard/ui";

import { AuthField, AuthLayout, AuthLink } from "./AuthLayout";

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
    <AuthLayout
      title="Create your account"
      subtitle="Start drawing and sharing scenes with your team."
      footer={
        <>
          Already have an account?{" "}
          <AuthLink onClick={onSwitchToLogin}>Sign in</AuthLink>
        </>
      }
    >
      <ErrorBanner message={error || localError} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Name"
          hint="Optional"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="name"
          placeholder="Your name"
        />
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="name@company.com"
        />
        <AuthField
          label="Password"
          hint="At least 6 characters"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="mt-1 w-full py-2.5"
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
