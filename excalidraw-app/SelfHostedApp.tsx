import { useState, useCallback, useRef, useEffect } from "react";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { RegisterPage } from "./auth/RegisterPage";
import { serverData } from "./data/ServerData";

import type { ReactNode } from "react";

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const [page, setPage] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  if (isLoading) {
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
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    if (page === "login") {
      return (
        <LoginPage
          onLogin={async (email, password) => {
            setError("");
            try {
              await login(email, password);
            } catch (err: any) {
              setError(err.message);
              throw err;
            }
          }}
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

export function SelfHostedAppWrapper({
  children,
}: {
  children: (props: {
    onServerSave: (elements: any, appState: any, files: any) => void;
    currentSceneId: string | null;
  }) => ReactNode;
}) {
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const sceneIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lastSceneId = localStorage.getItem("excalidraw-last-scene-id");
    if (lastSceneId) {
      sceneIdRef.current = lastSceneId;
      setCurrentSceneId(lastSceneId);
      serverData.setCurrentSceneId(lastSceneId);
    }
  }, []);

  const handleServerSave = useCallback(
    (elements: any, appState: any, _files: any) => {
      serverData.save(elements, appState).then((id) => {
        if (id && id !== sceneIdRef.current) {
          sceneIdRef.current = id;
          setCurrentSceneId(id);
          localStorage.setItem("excalidraw-last-scene-id", id);
        }
      });
    },
    [],
  );

  return (
    <AuthProvider>
      <AuthGate>
        {children({
          onServerSave: handleServerSave,
          currentSceneId,
        })}
      </AuthGate>
    </AuthProvider>
  );
}

export default SelfHostedAppWrapper;
