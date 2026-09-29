import { DashboardThemeProvider } from "../components/dashboard/theme";
import { PencilIcon } from "../components/dashboard/icons";

import type { ReactNode } from "react";

/**
 * Frame of the signed-out pages (sign in, register, loading), in the
 * dashboard's design system and light/dark preference.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** under the card, e.g. "Don't have an account?" */
  footer?: ReactNode;
}) {
  return (
    <DashboardThemeProvider>
      <div className="dashboard-root flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10 text-gray-900">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <PencilIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">Excalidraw</span>
        </div>
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {title && (
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </div>
        {footer && <p className="mt-6 text-sm text-gray-500">{footer}</p>}
      </div>
    </DashboardThemeProvider>
  );
}

/** Labeled input in the dashboard's form style */
export function AuthField({
  label,
  hint,
  ...input
}: {
  label: string;
  hint?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
      <span className="flex items-baseline justify-between">
        {label}
        {hint && (
          <span className="text-xs font-normal text-gray-400">{hint}</span>
        )}
      </span>
      <input
        {...input}
        className={`rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${
          input.className ?? ""
        }`}
      />
    </label>
  );
}

/** Text button styled as a link; `muted` for secondary ones (e.g. "Back") */
export function AuthLink({
  muted,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { muted?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`cursor-pointer font-medium hover:underline ${
        muted ? "text-gray-500 hover:text-gray-700" : "text-indigo-600"
      } ${className}`}
    />
  );
}
