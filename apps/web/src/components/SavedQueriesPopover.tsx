import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { activateGraphFiltersOverlay } from './graph-filters-overlay';
import {
  SavedGraphQueries,
  type SavedGraphQueriesState,
} from './SavedGraphQueries';

/** Local nonmodal disclosure; opening/closing never calls a graph/query action. */
export const SavedQueriesPopover = memo(function SavedQueriesPopover(
  props: SavedGraphQueriesState,
) {
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
        aria-controls="network-saved-queries-panel"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="network-explorer__saved-queries"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        Saved queries
      </button>
      {!open
        ? null
        : createPortal(
            <section
              aria-labelledby="network-saved-queries-heading"
              className="network-saved-queries"
              data-graph-history-shortcuts="off"
              data-graph-scroll-container
              id="network-saved-queries-panel"
              ref={panelRef}
              role="dialog"
              style={position}
            >
              <button
                aria-label="Close Saved queries"
                className="network-explorer__close"
                onClick={closeAndRestore}
                title="Close Saved queries"
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
              <SavedGraphQueries {...props} idPrefix="network-saved-queries" />
            </section>,
            document.body,
          )}
    </>
  );
});
