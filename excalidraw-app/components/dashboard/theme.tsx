import { createContext, useContext, useLayoutEffect } from "react";

import type { Theme } from "@excalidraw/element/types";

import { useHandleAppTheme } from "../../useHandleAppTheme";

import type { ReactNode } from "react";

type ThemeChoice = Theme | "system";

const DashboardThemeContext = createContext<{
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}>({ theme: "light", setTheme: () => {} });

export const useDashboardTheme = () => useContext(DashboardThemeContext);

/**
 * Same theme preference as the editor (shared localStorage key), applied to the
 * dashboard through `html.dashboard-dark` (see tailwind.css).
 */
export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dashboard-dark", editorTheme === "dark");
    return () => root.classList.remove("dashboard-dark");
  }, [editorTheme]);

  return (
    <DashboardThemeContext.Provider
      value={{ theme: appTheme, setTheme: setAppTheme }}
    >
      {children}
    </DashboardThemeContext.Provider>
  );
}
