import { memo, useCallback, useState } from 'react';

import type { SavedViewEntry } from '../persistence/saved-views';

export interface SavedViewsState {
  readonly views: readonly SavedViewEntry[];
  readonly status: string;
  readonly writable: boolean;
  readonly recoveryAvailable: boolean;
  readonly onApply: (name: string) => string | undefined;
  readonly onDelete: (name: string) => string | undefined;
  readonly onRename: (name: string, nextName: string) => string | undefined;
  readonly onReset: () => string | undefined;
  readonly onSave: (name: string) => string | undefined;
  readonly onUpdate: (name: string) => string | undefined;
}

function savedViewSummary(entry: SavedViewEntry): string {
  const scope = entry.view.presentationMode === 'local' ? 'Focus' : 'All';
  const layout = entry.layout === 'network' ? 'Network' : 'Hierarchy';
  const query = entry.view.projection.filters?.query;
  return `${scope} · ${layout}${query === undefined ? '' : ` · ${query}`}`;
}

/** Registry management presentation; storage and graph transactions stay with the owner. */
export const SavedViews = memo(function SavedViews({
  views,
  status,
  writable,
  recoveryAvailable,
  onApply,
  onDelete,
  onRename,
  onReset,
  onSave,
  onUpdate,
  idPrefix,
}: SavedViewsState & { readonly idPrefix: string }) {
  const [name, setName] = useState('');
  const [issue, setIssue] = useState<string>();
  const [rename, setRename] = useState<{
    readonly current: string;
    readonly draft: string;
  }>();
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>();
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const save = useCallback(() => {
    const error = onSave(name);
    setIssue(error);
    if (error === undefined) setName('');
  }, [name, onSave]);

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="saved-views">
      <h3 id={`${idPrefix}-heading`}>Saved Views</h3>
      <p>{status}</p>
      <label htmlFor={`${idPrefix}-name`}>
        Name
        <input
          autoComplete="off"
          id={`${idPrefix}-name`}
          maxLength={64}
          onChange={(event) => {
            setName(event.currentTarget.value);
            setIssue(undefined);
          }}
          value={name}
        />
      </label>
      <button disabled={!writable} onClick={save} type="button">
        Save current view
      </button>
      {issue === undefined ? null : (
        <p className="saved-views__error" role="alert">
          {issue}
        </p>
      )}
      {views.length === 0 ? (
        <p>No Saved Views for this workspace.</p>
      ) : (
        <ul>
          {views.map((entry) => {
            const renaming = rename?.current === entry.name;
            const confirmingDelete = deleteConfirmation === entry.name;
            return (
              <li key={entry.name}>
                <div className="saved-views__entry">
                  {renaming ? (
                    <label htmlFor={`${idPrefix}-rename`}>
                      New name
                      <input
                        autoComplete="off"
                        id={`${idPrefix}-rename`}
                        maxLength={64}
                        onChange={(event) => {
                          setRename({
                            current: entry.name,
                            draft: event.currentTarget.value,
                          });
                          setIssue(undefined);
                        }}
                        value={rename.draft}
                      />
                    </label>
                  ) : (
                    <strong>{entry.name}</strong>
                  )}
                  <small>{savedViewSummary(entry)}</small>
                </div>
                <div className="saved-views__actions">
                  {renaming ? (
                    <>
                      <button
                        onClick={() => {
                          const error = onRename(entry.name, rename.draft);
                          setIssue(error);
                          if (error === undefined) setRename(undefined);
                        }}
                        type="button"
                      >
                        Save name
                      </button>
                      <button
                        onClick={() => {
                          setRename(undefined);
                          setIssue(undefined);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : confirmingDelete ? (
                    <>
                      <button
                        onClick={() => {
                          const error = onDelete(entry.name);
                          setIssue(error);
                          if (error === undefined)
                            setDeleteConfirmation(undefined);
                        }}
                        type="button"
                      >
                        Confirm delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmation(undefined)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIssue(onApply(entry.name))}
                        type="button"
                      >
                        Apply
                      </button>
                      <button
                        disabled={!writable}
                        onClick={() => setIssue(onUpdate(entry.name))}
                        type="button"
                      >
                        Update
                      </button>
                      <button
                        disabled={!writable}
                        onClick={() => {
                          setRename({ current: entry.name, draft: entry.name });
                          setDeleteConfirmation(undefined);
                          setIssue(undefined);
                        }}
                        type="button"
                      >
                        Rename
                      </button>
                      <button
                        disabled={!writable}
                        onClick={() => {
                          setDeleteConfirmation(entry.name);
                          setRename(undefined);
                          setIssue(undefined);
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!recoveryAvailable ? null : resetConfirmation ? (
        <div className="saved-views__recovery">
          <p>Delete only this workspace&apos;s Saved Views registry?</p>
          <button
            onClick={() => {
              const error = onReset();
              setIssue(error);
              if (error === undefined) setResetConfirmation(false);
            }}
            type="button"
          >
            Confirm reset
          </button>
          <button onClick={() => setResetConfirmation(false)} type="button">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setResetConfirmation(true)} type="button">
          Reset Saved Views registry
        </button>
      )}
    </section>
  );
});
