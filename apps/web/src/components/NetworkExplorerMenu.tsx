import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  networkExplorerMenuIndex,
  type NetworkExplorerAction,
  type NetworkExplorerMenuAction,
} from '../network-explorer-context';

/** One small portal per open menu, never one hidden menu per virtual row. */
export function NetworkExplorerMenu({
  actions,
  name,
  x,
  y,
  onCancel,
  onAction,
  editor,
}: {
  readonly actions: readonly NetworkExplorerMenuAction[];
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly onCancel: (restoreFocus: boolean) => void;
  readonly onAction: (action: NetworkExplorerAction) => void;
  /** An action's editor replaces the menu in the same portal/lifetime. */
  readonly editor?: { readonly label: string; readonly content: ReactNode };
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [active, setActive] = useState(() =>
    networkExplorerMenuIndex(actions, -1, 'Home'),
  );
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
    // Focus the editor only on entry, never again for slider value updates.
    if (editing) {
      (
        menu.querySelector<HTMLElement>('input[type="range"]:not(:disabled)') ??
        menu.querySelector<HTMLElement>('button')
      )?.focus();
    } else
      buttons.current
        .get(networkExplorerMenuIndex(actions, -1, 'Home'))
        ?.focus();
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
  }, [actions, editing, x, y]);
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
          // Keep the editor keyboard-contained, without stealing range/select keys.
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
        const next = networkExplorerMenuIndex(actions, active, event.key);
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          setActive(next);
          buttons.current.get(next)?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const action = actions[active];
          if (action !== undefined && action.disabledReason === undefined)
            onAction(action.id);
        }
      }}
      ref={menuRef}
      role={editing ? 'dialog' : 'menu'}
      style={{ left: position.x, top: position.y }}
    >
      {editor === undefined ? (
        actions.map((action, index) => (
          <button
            aria-describedby={
              action.disabledReason === undefined
                ? undefined
                : `network-menu-${action.id}-reason`
            }
            aria-disabled={
              action.disabledReason === undefined ? undefined : true
            }
            disabled={action.disabledReason !== undefined}
            key={action.id}
            onClick={() => onAction(action.id)}
            onFocus={() => setActive(index)}
            ref={(element) => {
              if (element === null) buttons.current.delete(index);
              else buttons.current.set(index, element);
            }}
            role="menuitem"
            tabIndex={index === active ? 0 : -1}
            type="button"
          >
            {action.label}
            {action.disabledReason === undefined ? null : (
              <small id={`network-menu-${action.id}-reason`}>
                {action.disabledReason}
              </small>
            )}
          </button>
        ))
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
