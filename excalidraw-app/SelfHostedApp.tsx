import { useState } from "react";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthLayout } from "./auth/AuthLayout";
import { LoginPage } from "./auth/LoginPage";
import { RegisterPage } from "./auth/RegisterPage";

import type { ReactNode } from "react";

function AuthGate({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    login,
    completeMfaLogin,
    loginWithPasskey,
    register,
  } = useAuth();
  const [page, setPage] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <AuthLayout>
        <p className="text-center text-sm text-gray-500">Loading...</p>
      </AuthLayout>
    );
  }

  if (!isAuthenticated) {
    if (page === "login") {
      return (
        <LoginPage
          onLogin={(email, password) => {
            setError("");
            return login(email, password);
          }}
          onVerifyMfa={completeMfaLogin}
          onPasskeyLogin={loginWithPasskey}
          onSwitchToRegister={() => setPage("register")}
          error={error}
        />
      );
    }
    return (
      <RegisterPage
        onRegister={async (email, password, name) => {
          setError("");
          try {
            await register(email, password, name);
          } catch (err: any) {
            setError(err.message);
            throw err;
          }
        }}
        onSwitchToLogin={() => setPage("login")}
        error={error}
      />
    );
  }

  return <>{children}</>;
}

export function SelfHostedAppWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}

export default SelfHostedAppWrapper;
