import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export interface GraphContextMenuAction<ActionId extends string = string> {
  readonly id: ActionId;
  readonly label: string;
  readonly disabledReason?: string;
}

export interface GraphContextMenuSeparator {
  readonly kind: 'separator';
  readonly emphasis: 'strong';
}

export type GraphContextMenuItem<ActionId extends string = string> =
  GraphContextMenuAction<ActionId> | GraphContextMenuSeparator;

function isSeparator(
  item: GraphContextMenuItem,
): item is GraphContextMenuSeparator {
  return 'kind' in item && item.kind === 'separator';
}

function menuIndex(
  items: readonly GraphContextMenuItem[],
  current: number,
  key: string,
): number {
  const enabled = items.flatMap((item, index) =>
    !isSeparator(item) && item.disabledReason === undefined ? [index] : [],
  );
  if (enabled.length === 0) return -1;
  if (key === 'Home') return enabled[0]!;
  if (key === 'End') return enabled.at(-1)!;
  const offset = enabled.indexOf(current);
  if (key === 'ArrowDown') return enabled[(offset + 1) % enabled.length]!;
  if (key === 'ArrowUp')
    return enabled[(offset - 1 + enabled.length) % enabled.length]!;
  return current;
}

/** Shared bounded, nonmodal graph menu used by Network and Modular views. */
export function GraphContextMenu<ActionId extends string>({
  items,
  name,
  x,
  y,
  onCancel,
  onAction,
  editor,
}: {
  readonly items: readonly GraphContextMenuItem<ActionId>[];
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly onCancel: (restoreFocus: boolean) => void;
  readonly onAction: (action: ActionId) => void;
  readonly editor?: { readonly label: string; readonly content: ReactNode };
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [active, setActive] = useState(() => menuIndex(items, -1, 'Home'));
  const [position, setPosition] = useState({ x, y });
  const editing = editor !== undefined;
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const place = () => {
      const rect = menu.getBoundingClientRect();
      const next = {
        x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
        y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
      };
      setPosition((current) =>
        current.x === next.x && current.y === next.y ? current : next,
      );
    };
    place();
    if (editing)
      (
        menu.querySelector<HTMLElement>('input[type="range"]:not(:disabled)') ??
        menu.querySelector<HTMLElement>('button')
      )?.focus();
    else (buttons.current.get(menuIndex(items, -1, 'Home')) ?? menu).focus();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(place);
    observer?.observe(menu);
    window.addEventListener('resize', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [items, editing, x, y]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      )
        onCancel(false);
    };
    window.addEventListener('pointerdown', outside, true);
    return () => window.removeEventListener('pointerdown', outside, true);
  }, [onCancel]);
  return createPortal(
    <div
      aria-label={
        editor === undefined
          ? `Actions for ${name}`
          : `${editor.label} for ${name}`
      }
      className={`network-explorer-menu${editing ? ' network-explorer-menu--editor' : ''}`}
      data-graph-history-shortcuts="off"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel(true);
          return;
        }
        if (editing) {
          if (event.key === 'Tab') {
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), select:not(:disabled), input:not(:disabled)',
              ),
            ];
            const boundary = event.shiftKey ? controls[0] : controls.at(-1);
            if (document.activeElement === boundary) {
              event.preventDefault();
              (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
            }
          }
          return;
        }
        if (event.key === 'Tab') {
          onCancel(true);
          return;
        }
        const next = menuIndex(items, active, event.key);
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          setActive(next);
          buttons.current.get(next)?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const item = items[active];
          if (
            item !== undefined &&
            !isSeparator(item) &&
            item.disabledReason === undefined
          )
            onAction(item.id);
        }
      }}
      ref={menuRef}
      role={editing ? 'dialog' : 'menu'}
      style={{ left: position.x, top: position.y }}
      tabIndex={-1}
    >
      {editor === undefined ? (
        items.map((item, index) =>
          isSeparator(item) ? (
            <div
              className="network-explorer-menu__separator network-explorer-menu__separator--strong"
              data-emphasis={item.emphasis}
              key={`separator-${index}`}
              role="separator"
            />
          ) : (
            <button
              aria-describedby={
                item.disabledReason === undefined
                  ? undefined
                  : `graph-menu-${index}-reason`
              }
              aria-disabled={
                item.disabledReason === undefined ? undefined : true
              }
              disabled={item.disabledReason !== undefined}
              key={item.id}
              onClick={() => onAction(item.id)}
              onFocus={() => setActive(index)}
              ref={(element) => {
                if (element === null) buttons.current.delete(index);
                else buttons.current.set(index, element);
              }}
              role="menuitem"
              tabIndex={index === active ? 0 : -1}
              type="button"
            >
              {item.label}
              {item.disabledReason === undefined ? null : (
                <small id={`graph-menu-${index}-reason`}>
                  {item.disabledReason}
                </small>
              )}
            </button>
          ),
        )
      ) : (
        <>
          <header className="network-explorer-menu__heading">
            <strong>{name}</strong>
            <button
              aria-label="Close size editor"
              onClick={() => onCancel(true)}
              type="button"
            >
              ×
            </button>
          </header>
          {editor.content}
        </>
      )}
    </div>,
    document.body,
  );
}
