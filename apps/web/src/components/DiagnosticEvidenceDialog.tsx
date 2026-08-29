import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react';

import { activateDiagnosticEvidenceOverlay } from './diagnostic-evidence-overlay';

export function DiagnosticEvidenceDialog({
  children,
  onClose,
}: {
  readonly children: ReactNode;
  readonly onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const closeButton = closeButtonRef.current;
    if (dialog === null || closeButton === null) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    const fallbackFocus = document.getElementById('main-content') ?? undefined;
    dialog.showModal();
    const deactivate = activateDiagnosticEvidenceOverlay(
      {
        bodyStyle: document.body.style,
        initialFocus: closeButton,
        ...(returnFocus === undefined ? {} : { returnFocus }),
        ...(fallbackFocus === undefined ? {} : { fallbackFocus }),
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      onClose,
    );
    return () => {
      deactivate();
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  function cancelDialog(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      aria-labelledby="diagnostic-evidence-title"
      className="diagnostic-dialog"
      onCancel={cancelDialog}
      ref={dialogRef}
    >
      <div className="diagnostic-dialog__surface">
        <header className="diagnostic-dialog__heading">
          <div>
            <p className="eyebrow">Developer</p>
            <h2 id="diagnostic-evidence-title">Diagnostic Evidence</h2>
          </div>
          <button onClick={onClose} ref={closeButtonRef} type="button">
            Close
          </button>
        </header>
        <div className="diagnostic-dialog__body" data-graph-scroll-container>
          {children}
        </div>
      </div>
    </dialog>
  );
}
