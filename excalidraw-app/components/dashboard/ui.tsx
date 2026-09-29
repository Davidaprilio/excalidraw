import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  ButtonHTMLAttributes,
  FormEvent,
  ReactNode,
  RefObject,
} from "react";

// ---- Button ----

const BUTTON_VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  ghost: "text-gray-600 hover:bg-gray-100",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

// ---- Dismiss on outside click / Escape ----

export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, onDismiss, active]);
}

// ---- Dropdown menu ----

export type MenuItem =
  | {
      label: string;
      onSelect: () => void;
      icon?: ReactNode;
      danger?: boolean;
      checked?: boolean;
    }
  | "separator";

export function DropdownMenu({
  trigger,
  items,
  align = "right",
  side = "bottom",
  triggerClassName = "",
  menuClassName = "",
  label = "Open menu",
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  /** "top": open upwards (e.g. at the bottom of the sidebar) */
  side?: "top" | "bottom";
  triggerClassName?: string;
  menuClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  return (
    <div
      ref={ref}
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={`cursor-pointer ${triggerClassName}`}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 min-w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
            side === "top" ? "bottom-full mb-2" : "top-full mt-1"
          } ${align === "right" ? "right-0" : "left-0"} ${menuClassName}`}
        >
          <MenuList items={items} onClose={close} />
        </div>
      )}
    </div>
  );
}

/** The items of a DropdownMenu / ContextMenu */
function MenuList({
  items,
  onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  return (
    <>
      {items.map((item, index) =>
        item === "separator" ? (
          <div key={index} className="my-1 border-t border-gray-100" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm ${
              item.danger
                ? "text-red-600 hover:bg-red-50"
                : "text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span className="flex w-4 justify-center text-gray-400">
              {item.checked ? (
                <span className="text-indigo-600">✓</span>
              ) : (
                item.icon
              )}
            </span>
            {item.label}
          </button>
        ),
      )}
    </>
  );
}

/**
 * Right-click menu at the cursor (same items/look as DropdownMenu). Kept inside
 * the viewport; closes on outside click, Escape, scroll or resize.
 */
export function ContextMenu({
  at,
  items,
  onClose,
}: {
  at: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => ({ left: at.x, top: at.y }));
  useDismiss(ref, onClose);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) {
      return;
    }
    const margin = 8;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(
        margin,
        at.x + width > window.innerWidth - margin ? at.x - width : at.x,
      ),
      top: Math.max(
        margin,
        at.y + height > window.innerHeight - margin ? at.y - height : at.y,
      ),
    });
  }, [at]);

  useEffect(() => {
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={position}
      className="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

// ---- Modal / prompt ----

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/30 px-4 pt-[15vh]">
      <div
        ref={ref}
        role="dialog"
        aria-label={title}
        className={`w-full ${width} rounded-xl bg-white p-6 shadow-2xl`}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Single text field dialog (optionally with extra fields in `children`). */
export function PromptDialog({
  title,
  label,
  initialValue = "",
  placeholder,
  confirmLabel,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          {label}
          <input
            autoFocus
            value={value}
            placeholder={placeholder}
            maxLength={255}
            onChange={(event) => setValue(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        {children}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !value.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Layout pieces ----

export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4 border-b border-gray-200 pb-6">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
          {icon && <span className="text-gray-700">{icon}</span>}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && (
          <div className="mt-2 text-sm text-gray-500">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-indigo-600">{title}</h2>
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-gray-200 p-6">
      <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-500">
        {icon}
      </div>
      <p className="font-medium text-gray-800">{title}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
];

export function Avatar({
  name,
  size = "h-8 w-8 text-sm",
  src,
}: {
  name: string;
  size?: string;
  /** photo URL; falls back to the initial when missing or broken */
  src?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const hash = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        draggable={false}
        onError={() => setBroken(true)}
        className={`inline-block shrink-0 rounded-full object-cover ${size}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size} ${
        AVATAR_COLORS[hash % AVATAR_COLORS.length]
      }`}
    >
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return message ? (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  ) : null;
}

/** Section card used by the settings pages */
export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---- Toast ----

const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div
          role="status"
          className="dashboard-root fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ---- Formatting ----

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(date: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return relativeTime.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}
