import { useCallback, useRef, useState } from "react";

import { ChevronRightIcon } from "../dashboard/icons";
import { useDismiss } from "../dashboard/ui";

import type { ReactNode } from "react";

export type SidebarMenuItem =
  | {
      label: string;
      icon?: ReactNode;
      onSelect?: () => void;
      /** opens a nested menu to the right */
      submenu?: SidebarMenuItem[];
      danger?: boolean;
      checked?: boolean;
    }
  | "separator";

type Position = { top: number; left: number };

/**
 * Dropdown with optional submenus. Menus are `position: fixed` so the
 * sidebar's scroll container doesn't clip them.
 */
export function SidebarMenu({
  trigger,
  items,
  label,
  triggerClassName,
}: {
  trigger: ReactNode;
  items: SidebarMenuItem[];
  label: string;
  triggerClassName: string;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPosition(null), []);
  useDismiss(ref, close, !!position);

  return (
    <div ref={ref} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={!!position}
        className={triggerClassName}
        onClick={(event) => {
          if (position) {
            close();
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({ top: rect.bottom + 4, left: rect.left });
        }}
      >
        {trigger}
      </button>
      {position && (
        <MenuList items={items} position={position} onDone={close} />
      )}
    </div>
  );
}

function MenuList({
  items,
  position,
  onDone,
}: {
  items: SidebarMenuItem[];
  position: Position;
  onDone: () => void;
}) {
  const [open, setOpen] = useState<{
    index: number;
    position: Position;
  } | null>(null);

  return (
    <div
      role="menu"
      className="app-editor-sidebar__menu"
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item, index) =>
        item === "separator" ? (
          <div key={index} className="app-editor-sidebar__menu-separator" />
        ) : (
          <div key={item.label}>
            <button
              type="button"
              role="menuitem"
              aria-haspopup={item.submenu ? "menu" : undefined}
              aria-expanded={item.submenu ? open?.index === index : undefined}
              className={`app-editor-sidebar__menu-item${
                item.danger ? " is-danger" : ""
              }${open?.index === index ? " is-open" : ""}`}
              onMouseEnter={(event) => {
                if (item.submenu) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpen({
                    index,
                    position: { top: rect.top - 5, left: rect.right + 4 },
                  });
                } else {
                  setOpen(null);
                }
              }}
              onClick={(event) => {
                if (item.submenu) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpen({
                    index,
                    position: { top: rect.top - 5, left: rect.right + 4 },
                  });
                  return;
                }
                onDone();
                item.onSelect?.();
              }}
            >
              <span className="app-editor-sidebar__menu-icon">
                {item.checked ? "✓" : item.icon}
              </span>
              <span className="app-editor-sidebar__menu-label">
                {item.label}
              </span>
              {item.submenu && <ChevronRightIcon />}
            </button>
            {item.submenu && open?.index === index && (
              <MenuList
                items={item.submenu}
                position={open.position}
                onDone={onDone}
              />
            )}
          </div>
        ),
      )}
    </div>
  );
}
