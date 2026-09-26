import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface ArgumentActionMenuHandle {
  closeAndFocus(): boolean;
  focusTrigger(): void;
}

interface ArgumentActionMenuProps {
  readonly align?: 'start' | 'end';
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly label: string;
}

function menuItems(container: HTMLElement | null): HTMLElement[] {
  return container === null
    ? []
    : [
        ...container.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled])',
        ),
      ];
}

/** Small Arguments-only disclosure menu with predictable keyboard focus. */
export const ArgumentActionMenu = forwardRef<
  ArgumentActionMenuHandle,
  ArgumentActionMenuProps
>(function ArgumentActionMenu(
  { align = 'start', children, className, disabled = false, label },
  ref,
) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeAndFocus = useCallback((): boolean => {
    if (!open) return false;
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
    return true;
  }, [open]);

  useImperativeHandle(
    ref,
    () => ({
      closeAndFocus,
      focusTrigger() {
        triggerRef.current?.focus();
      },
    }),
    [closeAndFocus],
  );

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target) !== true
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  function focusItem(index: number) {
    const items = menuItems(menuRef.current);
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocus();
      return;
    }
    const items = menuItems(menuRef.current);
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  }

  return (
    <div
      className={`argument-action-menu${className === undefined ? '' : ` ${className}`}`}
      ref={containerRef}
    >
      <button
        aria-label={label}
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
          queueMicrotask(() => focusItem(0));
        }}
        ref={triggerRef}
        type="button"
      >
        {label} ▾
      </button>
      {open ? (
        <div
          aria-label={label}
          className={`argument-action-menu__popover argument-action-menu__popover--${align}`}
          id={menuId}
          onClick={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest('[role="menuitem"]') !== null &&
              event.target.closest('[data-menu-keep-open]') === null
            ) {
              closeAndFocus();
            }
          }}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
});
