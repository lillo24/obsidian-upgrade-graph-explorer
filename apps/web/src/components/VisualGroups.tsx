import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import {
  MAX_VISUAL_GROUP_NAME_LENGTH,
  VISUAL_GROUP_PALETTE,
  visualGroupPaletteEntry,
  type VisualGroupColor,
  type VisualGroupDefinition,
} from '@icarus-graph-explorer/visual-groups';

import {
  addVisualGroup,
  deleteVisualGroup,
  moveVisualGroupDown,
  moveVisualGroupUp,
  setVisualGroupEnabled,
  updateVisualGroup,
  type VisualGroupRegistry,
  type VisualGroupRegistryMutationResult,
} from '../persistence/visual-groups';
import type {
  VisualGroupPersistenceMode,
  VisualGroupSession,
} from '../visual-groups/session';
import { activateGraphFiltersEscape } from './graph-filters-overlay';
import {
  prepareVisualGroupDefinition,
  type VisualGroupDraft,
} from './visual-group-editor';

interface VisualGroupsProps {
  readonly activeQuery?: string;
  readonly contained: boolean;
  readonly error?: string;
  readonly onCommit: (
    candidate: VisualGroupRegistry,
    announcement: string,
  ) => string | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly onResetSaved: () => string | undefined;
  readonly open: boolean;
  readonly session: VisualGroupSession;
}

type ActiveEditor =
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly originalName: string };

const DEFAULT_COLOR = VISUAL_GROUP_PALETTE[0].token;

function emptyDraft(): VisualGroupDraft {
  return { name: '', query: '', color: DEFAULT_COLOR, enabled: true };
}

function accentStyle(color: VisualGroupColor): CSSProperties {
  return {
    '--visual-group-accent': visualGroupPaletteEntry(color).accent,
  } as CSSProperties;
}

function canMutate(mode: VisualGroupPersistenceMode): boolean {
  return mode === 'durable' || mode === 'session-only';
}

export const VisualGroups = memo(function VisualGroups({
  activeQuery,
  contained,
  error,
  onCommit,
  onOpenChange,
  onResetSaved,
  open,
  session,
}: VisualGroupsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const editorReturnTarget = useRef<string | 'new'>('new');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor>();
  const [draft, setDraft] = useState<VisualGroupDraft>(emptyDraft);
  const [editorIssue, setEditorIssue] = useState<{
    readonly field?: 'name' | 'query';
    readonly message: string;
  }>();
  const [panelIssue, setPanelIssue] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const enabledCount = session.registry.groups.filter(
    (group) => group.enabled,
  ).length;
  const mutationsEnabled = canMutate(session.persistenceMode);

  const closeAndRestoreTrigger = useCallback(() => {
    onOpenChange(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, [onOpenChange]);

  useEffect(() => {
    if (!open || triggerRef.current === null || typeof window === 'undefined') {
      return;
    }
    return activateGraphFiltersEscape(
      {
        trigger: triggerRef.current,
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      () => onOpenChange(false),
    );
  }, [onOpenChange, open]);

  useEffect(() => {
    if (activeEditor !== undefined) nameRef.current?.focus();
  }, [activeEditor]);

  const restoreEditorTarget = useCallback(() => {
    const target = editorReturnTarget.current;
    queueMicrotask(() => {
      if (target === 'new') newButtonRef.current?.focus();
      else editButtonRefs.current.get(target)?.focus();
    });
  }, []);

  const closeEditor = useCallback(() => {
    setActiveEditor(undefined);
    setEditorIssue(undefined);
    restoreEditorTarget();
  }, [restoreEditorTarget]);

  const startNew = useCallback(() => {
    editorReturnTarget.current = 'new';
    setDraft(emptyDraft());
    setEditorIssue(undefined);
    setPanelIssue(undefined);
    setPendingDelete(undefined);
    setActiveEditor({ kind: 'new' });
  }, []);

  const startEdit = useCallback((definition: VisualGroupDefinition) => {
    editorReturnTarget.current = definition.name;
    setDraft(definition);
    setEditorIssue(undefined);
    setPanelIssue(undefined);
    setPendingDelete(undefined);
    setActiveEditor({ kind: 'edit', originalName: definition.name });
  }, []);

  const commitCandidate = useCallback(
    (
      candidate: VisualGroupRegistryMutationResult,
      announcement: string,
    ): boolean => {
      if (!candidate.ok) {
        setPanelIssue(candidate.message);
        return false;
      }
      const issue = onCommit(candidate.value, announcement);
      setPanelIssue(issue);
      return issue === undefined;
    },
    [onCommit],
  );

  const saveEditor = useCallback(() => {
    if (activeEditor === undefined) return;
    const prepared = prepareVisualGroupDefinition(draft);
    if (!prepared.ok) {
      setEditorIssue({ field: prepared.field, message: prepared.message });
      return;
    }
    const candidate =
      activeEditor.kind === 'new'
        ? addVisualGroup(session.registry, prepared.value)
        : updateVisualGroup(
            session.registry,
            activeEditor.originalName,
            prepared.value,
          );
    if (!candidate.ok) {
      const field = /name|characters|duplicated/iu.test(candidate.message)
        ? 'name'
        : undefined;
      setEditorIssue({
        ...(field === undefined ? {} : { field }),
        message: candidate.message,
      });
      return;
    }
    const action = activeEditor.kind === 'new' ? 'Created' : 'Updated';
    const issue = onCommit(
      candidate.value,
      `${action} Visual Group “${prepared.value.name}”.`,
    );
    if (issue !== undefined) {
      setEditorIssue({ message: issue });
      return;
    }
    if (activeEditor.kind === 'edit') {
      editorReturnTarget.current = prepared.value.name;
    }
    setActiveEditor(undefined);
    setEditorIssue(undefined);
    restoreEditorTarget();
  }, [activeEditor, draft, onCommit, restoreEditorTarget, session.registry]);

  const toggleEnabled = useCallback(
    (definition: VisualGroupDefinition, enabled: boolean) => {
      void commitCandidate(
        setVisualGroupEnabled(session.registry, definition.name, enabled),
        `${enabled ? 'Enabled' : 'Disabled'} Visual Group “${definition.name}”.`,
      );
    },
    [commitCandidate, session.registry],
  );

  const move = useCallback(
    (definition: VisualGroupDefinition, direction: 'up' | 'down') => {
      void commitCandidate(
        direction === 'up'
          ? moveVisualGroupUp(session.registry, definition.name)
          : moveVisualGroupDown(session.registry, definition.name),
        `Moved Visual Group “${definition.name}” ${direction}.`,
      );
    },
    [commitCandidate, session.registry],
  );

  const confirmDelete = useCallback(
    (definition: VisualGroupDefinition, index: number) => {
      if (
        !commitCandidate(
          deleteVisualGroup(session.registry, definition.name),
          `Deleted Visual Group “${definition.name}”.`,
        )
      ) {
        return;
      }
      setPendingDelete(undefined);
      const remaining = session.registry.groups.filter(
        (group) => group.name !== definition.name,
      );
      const focusName = remaining[Math.min(index, remaining.length - 1)]?.name;
      queueMicrotask(() => {
        if (focusName === undefined) newButtonRef.current?.focus();
        else editButtonRefs.current.get(focusName)?.focus();
      });
    },
    [commitCandidate, session.registry],
  );

  const resetSaved = useCallback(() => {
    const issue = onResetSaved();
    setPanelIssue(issue);
    if (issue === undefined) {
      setConfirmReset(false);
      queueMicrotask(() => newButtonRef.current?.focus());
    }
  }, [onResetSaved]);

  return (
    <div className="visual-groups">
      <button
        aria-controls="visual-groups-panel"
        aria-expanded={open}
        aria-label={`Groups, ${enabledCount} enabled`}
        className="visual-groups__trigger"
        onClick={() => onOpenChange(!open)}
        ref={triggerRef}
        type="button"
      >
        <span>Groups</span>
        {enabledCount === 0 ? null : (
          <span aria-hidden="true" className="visual-groups__badge">
            {enabledCount}
          </span>
        )}
      </button>
      {open ? (
        <section
          aria-labelledby="visual-groups-heading"
          className={`visual-groups__panel${
            contained ? ' visual-groups__panel--contained' : ''
          }`}
          data-graph-scroll-container
          id="visual-groups-panel"
        >
          <div className="visual-groups__heading">
            <div>
              <h3 id="visual-groups-heading">Visual Groups</h3>
              <p>First matching enabled group supplies the node color.</p>
            </div>
            <button onClick={closeAndRestoreTrigger} type="button">
              Close
            </button>
          </div>
          <div className="visual-groups__body">
            <div className="visual-groups__status">
              <p>{session.status}</p>
              {error === undefined ? null : <p role="alert">{error}</p>}
              {session.persistenceMode !== 'blocked-corrupt' ? null : (
                <div className="visual-groups__reset">
                  {confirmReset ? (
                    <>
                      <p>
                        This deletes only this workspace’s saved Visual Groups.
                      </p>
                      <button onClick={resetSaved} type="button">
                        Confirm reset
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmReset(true)} type="button">
                      Reset saved Visual Groups
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              disabled={!mutationsEnabled || activeEditor !== undefined}
              onClick={startNew}
              ref={newButtonRef}
              type="button"
            >
              + New group
            </button>
            {activeEditor?.kind === 'new' ? (
              <VisualGroupEditor
                {...(activeQuery === undefined ? {} : { activeQuery })}
                draft={draft}
                {...(editorIssue === undefined ? {} : { issue: editorIssue })}
                nameRef={nameRef}
                onCancel={closeEditor}
                onChange={(next) => {
                  setDraft(next);
                  setEditorIssue(undefined);
                }}
                onSave={saveEditor}
              />
            ) : null}
            {panelIssue === undefined ? null : (
              <p className="visual-groups__error" role="alert">
                {panelIssue}
              </p>
            )}
            {session.registry.groups.length === 0 ? (
              <p className="visual-groups__empty">No Visual Groups yet.</p>
            ) : (
              <ol className="visual-groups__list">
                {session.registry.groups.map((definition, index) => (
                  <li key={definition.name}>
                    {activeEditor?.kind === 'edit' &&
                    activeEditor.originalName === definition.name ? (
                      <VisualGroupEditor
                        {...(activeQuery === undefined ? {} : { activeQuery })}
                        draft={draft}
                        {...(editorIssue === undefined
                          ? {}
                          : { issue: editorIssue })}
                        nameRef={nameRef}
                        onCancel={closeEditor}
                        onChange={(next) => {
                          setDraft(next);
                          setEditorIssue(undefined);
                        }}
                        onSave={saveEditor}
                      />
                    ) : (
                      <article className="visual-group-row">
                        <div className="visual-group-row__identity">
                          <span
                            aria-hidden="true"
                            className="visual-group-swatch"
                            style={accentStyle(definition.color)}
                          />
                          <strong>{definition.name}</strong>
                          <label>
                            <input
                              checked={definition.enabled}
                              disabled={
                                !mutationsEnabled || activeEditor !== undefined
                              }
                              onChange={(event) =>
                                toggleEnabled(
                                  definition,
                                  event.currentTarget.checked,
                                )
                              }
                              type="checkbox"
                            />
                            Enabled
                          </label>
                        </div>
                        <code>{definition.query}</code>
                        <div className="visual-group-row__actions">
                          <button
                            disabled={
                              !mutationsEnabled || activeEditor !== undefined
                            }
                            onClick={() => startEdit(definition)}
                            ref={(button) => {
                              if (button === null) {
                                editButtonRefs.current.delete(definition.name);
                              } else {
                                editButtonRefs.current.set(
                                  definition.name,
                                  button,
                                );
                              }
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            aria-label={`Move ${definition.name} up`}
                            disabled={
                              !mutationsEnabled ||
                              activeEditor !== undefined ||
                              index === 0
                            }
                            onClick={() => move(definition, 'up')}
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`Move ${definition.name} down`}
                            disabled={
                              !mutationsEnabled ||
                              activeEditor !== undefined ||
                              index === session.registry.groups.length - 1
                            }
                            onClick={() => move(definition, 'down')}
                            type="button"
                          >
                            ↓
                          </button>
                          {pendingDelete === definition.name ? (
                            <>
                              <button
                                onClick={() => confirmDelete(definition, index)}
                                type="button"
                              >
                                Confirm delete
                              </button>
                              <button
                                onClick={() => setPendingDelete(undefined)}
                                type="button"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={
                                !mutationsEnabled || activeEditor !== undefined
                              }
                              onClick={() => setPendingDelete(definition.name)}
                              type="button"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </article>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
});

export function VisualGroupEditor({
  activeQuery,
  draft,
  issue,
  nameRef,
  onCancel,
  onChange,
  onSave,
}: {
  readonly activeQuery?: string;
  readonly draft: VisualGroupDraft;
  readonly issue?: {
    readonly field?: 'name' | 'query';
    readonly message: string;
  };
  readonly nameRef: React.RefObject<HTMLInputElement | null>;
  readonly onCancel: () => void;
  readonly onChange: (draft: VisualGroupDraft) => void;
  readonly onSave: () => void;
}) {
  const nameInvalid = issue?.field === 'name';
  const queryInvalid = issue?.field === 'query';
  return (
    <div className="visual-group-editor" data-graph-history-shortcuts="off">
      <label htmlFor="visual-group-name">
        Name
        <input
          aria-describedby={
            nameInvalid ? 'visual-group-editor-error' : undefined
          }
          aria-invalid={nameInvalid || undefined}
          autoComplete="off"
          id="visual-group-name"
          maxLength={MAX_VISUAL_GROUP_NAME_LENGTH}
          onChange={(event) =>
            onChange({ ...draft, name: event.currentTarget.value })
          }
          ref={nameRef}
          value={draft.name}
        />
      </label>
      <label htmlFor="visual-group-rule">
        Rule
        <textarea
          aria-describedby={
            queryInvalid
              ? 'visual-group-rule-help visual-group-editor-error'
              : 'visual-group-rule-help'
          }
          aria-invalid={queryInvalid || undefined}
          id="visual-group-rule"
          onChange={(event) =>
            onChange({ ...draft, query: event.currentTarget.value })
          }
          rows={3}
          spellCheck={false}
          value={draft.query}
        />
      </label>
      <p id="visual-group-rule-help">
        Uses the same QUERY1 syntax as Advanced query: AND, OR, NOT, path,
        folder, title, text, kind, and level. path:&quot;notes&quot; contains
        path text case-insensitively; path=&quot;Notes/Foo.md&quot; is one exact
        File; folder=&quot;Notes&quot; matches that folder and all descendants.
      </p>
      {activeQuery === undefined || activeQuery.length === 0 ? null : (
        <button
          onClick={() => onChange({ ...draft, query: activeQuery })}
          type="button"
        >
          Use active query
        </button>
      )}
      <fieldset className="visual-group-palette">
        <legend>Color</legend>
        {VISUAL_GROUP_PALETTE.map((entry) => (
          <label key={entry.token} style={accentStyle(entry.token)}>
            <input
              checked={draft.color === entry.token}
              name="visual-group-color"
              onChange={() => onChange({ ...draft, color: entry.token })}
              type="radio"
              value={entry.token}
            />
            <span aria-hidden="true" className="visual-group-swatch" />
            <span>{entry.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="visual-group-editor__enabled">
        <input
          checked={draft.enabled}
          onChange={(event) =>
            onChange({ ...draft, enabled: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Enabled
      </label>
      {issue === undefined ? null : (
        <p className="visual-groups__error" id="visual-group-editor-error">
          {issue.message}
        </p>
      )}
      <div className="visual-group-editor__actions">
        <button onClick={onSave} type="button">
          Save
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
