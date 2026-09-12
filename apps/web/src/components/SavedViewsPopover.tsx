import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { activateGraphFiltersOverlay } from './graph-filters-overlay';
import { SavedViews, type SavedViewsState } from './SavedViews';

function BookmarkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="saved-views-trigger__icon"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 3h12v18l-6-4-6 4V3Z" />
    </svg>
  );
}

/** Viewport-bounded, nonmodal Saved Views surface shared by both graph modes. */
export const SavedViewsPopover = memo(function SavedViewsPopover(
  props: SavedViewsState,
) {
  const { onApply } = props;
  const reactId = useId().replaceAll(':', '');
  const panelId = `${reactId}-saved-views-panel`;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const closeAndRestore = useCallback(() => {
    close();
    queueMicrotask(() => {
      if (triggerRef.current?.isConnected)
        triggerRef.current.focus({ preventScroll: true });
    });
  }, [close]);
  const apply = useCallback(
    (name: string) => {
      const error = onApply(name);
      if (error === undefined) closeAndRestore();
      return error;
    },
    [closeAndRestore, onApply],
  );

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!open || trigger === null || panel === null) return;
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      setPosition({
        left: Math.max(
          8,
          Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8),
        ),
        top: Math.max(
          8,
          Math.min(
            rect.bottom + 8,
            window.innerHeight - panel.offsetHeight - 8,
          ),
        ),
      });
    };
    place();
    panel
      .querySelector<HTMLInputElement>('input')
      ?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(place);
    observer?.observe(panel);
    return () => {
      window.removeEventListener('resize', place);
      observer?.disconnect();
    };
  }, [open]);

  useEffect(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!open || trigger === null || panel === null) return;
    return activateGraphFiltersOverlay(
      {
        trigger,
        panelContains: (target) =>
          target instanceof Node && panel.contains(target),
        triggerContains: (target) =>
          target instanceof Node && trigger.contains(target),
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        addPointerdownListener: (listener) =>
          window.addEventListener('pointerdown', listener, true),
        removePointerdownListener: (listener) =>
          window.removeEventListener('pointerdown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      close,
    );
  }, [close, open]);

  return (
    <>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Saved Views"
        className="saved-views-trigger"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title="Saved Views"
        type="button"
      >
        <BookmarkIcon />
      </button>
      {!open
        ? null
        : createPortal(
            <section
              aria-labelledby={`${panelId}-heading`}
              className="saved-views-popover"
              data-graph-history-shortcuts="off"
              data-graph-scroll-container
              id={panelId}
              ref={panelRef}
              role="dialog"
              style={position}
            >
              <button
                aria-label="Close Saved Views"
                className="saved-views-popover__close"
                onClick={closeAndRestore}
                title="Close Saved Views"
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
              <SavedViews {...props} idPrefix={panelId} onApply={apply} />
            </section>,
            document.body,
          )}
    </>
  );
});
