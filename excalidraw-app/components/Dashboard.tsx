import { useEffect, useState } from "react";

import { AccountPage } from "./dashboard/pages/AccountPage";
import { CollectionPage } from "./dashboard/pages/CollectionPage";
import { PreferencesPage } from "./dashboard/pages/PreferencesPage";
import { HomePage, newScene } from "./dashboard/pages/HomePage";
import { InvitePage } from "./dashboard/pages/InvitePage";
import { MembersPage } from "./dashboard/pages/MembersPage";
import { SettingsPage } from "./dashboard/pages/SettingsPage";
import { TrashPage } from "./dashboard/pages/TrashPage";
import { QuickSearch } from "./dashboard/QuickSearch";
import { Sidebar } from "./dashboard/Sidebar";
import { DashboardThemeProvider } from "./dashboard/theme";
import { ToastProvider } from "./dashboard/ui";
import { WorkspaceProvider } from "./dashboard/WorkspaceContext";

/** Logged-in app outside the editor: "/", /collections/:id, /trash, /members, /settings, /account, /preferences, /invite/:token */
export function Dashboard({ path }: { path: string }) {
  const inviteMatch = path.match(/^\/invite\/([^/]+)$/);
  return (
    <DashboardThemeProvider>
      {inviteMatch ? (
        <InvitePage token={inviteMatch[1]} />
      ) : (
        <ToastProvider>
          <WorkspaceProvider>
            <Shell path={path} />
          </WorkspaceProvider>
        </ToastProvider>
      )}
    </DashboardThemeProvider>
  );
}

function Shell({ path }: { path: string }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.altKey && event.code === "KeyA") {
        event.preventDefault();
        newScene(path.match(/^\/collections\/([^/]+)$/)?.[1]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [path]);

  const collectionMatch = path.match(/^\/collections\/([^/]+)$/);
  const page = collectionMatch ? (
    <CollectionPage
      key={collectionMatch[1]}
      collectionId={collectionMatch[1]}
    />
  ) : path === "/trash" ? (
    <TrashPage />
  ) : path === "/members" ? (
    <MembersPage />
  ) : path === "/settings" ? (
    <SettingsPage />
  ) : path === "/account" ? (
    <AccountPage />
  ) : path === "/preferences" ? (
    <PreferencesPage />
  ) : (
    <HomePage />
  );

  return (
    <div className="dashboard-root flex h-screen bg-white text-gray-900">
      <Sidebar path={path} onOpenSearch={() => setSearchOpen(true)} />
      <main className="flex-1 overflow-y-auto px-10 py-8">{page}</main>
      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
