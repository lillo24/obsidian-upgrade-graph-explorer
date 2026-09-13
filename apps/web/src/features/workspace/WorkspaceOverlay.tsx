import { useEffect, useRef, type SyntheticEvent } from 'react';

import {
  ArgumentsWorkspacePanel,
  type ArgumentsWorkspaceHandle,
} from '../arguments/ArgumentsWorkspace';
import { activateArgumentWorkspaceOverlay } from '../arguments/argument-overlay';
import { ArgumentWorkspaceSession } from '../arguments/session';
import type { ArgumentSourceAccess } from '../arguments/source-capture';
import {
  ReviewWorkspace,
  type ReviewWorkspaceHandle,
} from '../ai-review/ReviewWorkspace';
import type { AiReviewController } from '../ai-review/controller';
import './workspace.css';

export type WorkspaceArea = 'arguments' | 'review';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function WorkspaceOverlay({
  area,
  argumentSession,
  argumentSourceAccess,
  controller,
  onAreaChange,
  onRequestClose,
  open,
  restoreFocus,
}: {
  readonly area: WorkspaceArea;
  readonly argumentSession: ArgumentWorkspaceSession;
  readonly argumentSourceAccess?: ArgumentSourceAccess;
  readonly controller: AiReviewController;
  readonly onAreaChange: (area: WorkspaceArea) => void;
  readonly onRequestClose: () => void;
  readonly open: boolean;
  readonly restoreFocus?: HTMLElement;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const argumentsRef = useRef<ArgumentsWorkspaceHandle>(null);
  const reviewRef = useRef<ReviewWorkspaceHandle>(null);
  const areaRef = useRef(area);
  const requestCloseRef = useRef<() => void>(() => undefined);

  function requestClose(): void {
    if (area === 'arguments') {
      argumentsRef.current?.requestExit(
        onRequestClose,
        'Close the workspace with unsaved Argument changes?',
      );
      return;
    }
    onRequestClose();
  }

  useEffect(() => {
    areaRef.current = area;
    requestCloseRef.current = () => {
      if (area === 'arguments') {
        argumentsRef.current?.requestExit(
          onRequestClose,
          'Close the workspace with unsaved Argument changes?',
        );
      } else {
        onRequestClose();
      }
    };
  }, [area, onRequestClose]);

  function changeArea(next: WorkspaceArea): void {
    if (next === area) return;
    const apply = () => {
      onAreaChange(next);
      queueMicrotask(() => {
        if (next === 'arguments') argumentsRef.current?.focusInitial();
        else reviewRef.current?.focusInitial();
      });
    };
    if (area === 'arguments') {
      argumentsRef.current?.requestExit(
        apply,
        'Switch to AI Review with unsaved Argument changes?',
      );
    } else {
      apply();
    }
  }

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const close = closeRef.current;
    if (dialog === null || close === null) return;
    if (!dialog.open) dialog.showModal();
    const fallback =
      document.getElementById('graph-tools-trigger') ??
      document.getElementById('main-content') ??
      undefined;
    const deactivate = activateArgumentWorkspaceOverlay(
      {
        bodyStyle: document.body.style,
        initialFocus: close,
        ...(restoreFocus === undefined ? {} : { returnFocus: restoreFocus }),
        ...(fallback === undefined ? {} : { fallbackFocus: fallback }),
        focusables: () => [
          ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ],
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      () => {
        if (areaRef.current === 'arguments') {
          argumentsRef.current?.handleEscape();
        } else if (reviewRef.current?.handleEscape() !== true) {
          requestCloseRef.current();
        }
      },
    );
    return () => {
      deactivate();
      if (dialog.open) dialog.close();
    };
  }, [open, restoreFocus]);

  function cancelNative(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    if (area === 'arguments') argumentsRef.current?.handleEscape();
    else if (reviewRef.current?.handleEscape() !== true) requestClose();
  }

  return (
    <dialog
      aria-labelledby="shared-workspace-title"
      className="workspace-dialog"
      onCancel={cancelNative}
      ref={dialogRef}
    >
      <div className="workspace-dialog__surface">
        <header className="workspace-dialog__chrome">
          <div
            className="workspace-dialog__tabs"
            role="tablist"
            aria-label="Local workspaces"
          >
            <span className="visually-hidden" id="shared-workspace-title">
              Local workspaces
            </span>
            <button
              aria-controls="arguments-workspace-area"
              aria-selected={area === 'arguments'}
              id="arguments-workspace-tab"
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') changeArea('review');
              }}
              onClick={() => changeArea('arguments')}
              role="tab"
              type="button"
            >
              Arguments
            </button>
            <button
              aria-controls="review-workspace-area"
              aria-selected={area === 'review'}
              id="review-workspace-tab"
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') changeArea('arguments');
              }}
              onClick={() => changeArea('review')}
              role="tab"
              type="button"
            >
              AI Review
            </button>
          </div>
          <button
            aria-label="Close local workspace"
            className="workspace-dialog__close"
            onClick={requestClose}
            ref={closeRef}
            type="button"
          >
            Close
          </button>
        </header>
        <div
          aria-labelledby="arguments-workspace-tab"
          className="workspace-dialog__area"
          hidden={area !== 'arguments'}
          id="arguments-workspace-area"
          inert={area !== 'arguments'}
          role="tabpanel"
        >
          <ArgumentsWorkspacePanel
            active={open && area === 'arguments'}
            onRequestClose={onRequestClose}
            ref={argumentsRef}
            session={argumentSession}
            {...(argumentSourceAccess === undefined
              ? {}
              : { sourceAccess: argumentSourceAccess })}
          />
        </div>
        <div
          aria-labelledby="review-workspace-tab"
          className="workspace-dialog__area"
          hidden={area !== 'review'}
          id="review-workspace-area"
          inert={area !== 'review'}
          role="tabpanel"
        >
          <ReviewWorkspace
            active={open && area === 'review'}
            controller={controller}
            ref={reviewRef}
          />
        </div>
      </div>
    </dialog>
  );
}
