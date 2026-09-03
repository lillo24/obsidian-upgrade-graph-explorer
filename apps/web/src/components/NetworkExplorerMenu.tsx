import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
}: {
  readonly actions: readonly NetworkExplorerMenuAction[];
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly onCancel: (restoreFocus: boolean) => void;
  readonly onAction: (action: NetworkExplorerAction) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [active, setActive] = useState(() =>
    networkExplorerMenuIndex(actions, -1, 'Home'),
  );
  const [position, setPosition] = useState({ x, y });
  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    setPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
    buttons.current.get(networkExplorerMenuIndex(actions, -1, 'Home'))?.focus();
  }, [actions, x, y]);
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
      aria-label={`Actions for ${name}`}
      className="network-explorer-menu"
      data-graph-history-shortcuts="off"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel(true);
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
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      {actions.map((action, index) => (
        <button
          aria-describedby={
            action.disabledReason === undefined
              ? undefined
              : `network-menu-${action.id}-reason`
          }
          aria-disabled={action.disabledReason === undefined ? undefined : true}
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
      ))}
    </div>,
    document.body,
  );
}
