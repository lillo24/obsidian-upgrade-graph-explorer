import {
  Suspense,
  forwardRef,
  lazy,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react';

import type {
  ReviewModelConfiguration,
  ReviewTemplates,
} from '@icarus-graph-explorer/ai-review';
import type { ReviewHistorySummary } from '@icarus-graph-explorer/review-workspace';
import type { ReviewSourceFileDescriptor } from '@icarus-graph-explorer/review-source-tauri';

import type { AiReviewController } from './controller';
import './review.css';

const ReviewResults = lazy(() => import('./ReviewResults'));

type ReviewView = 'setup' | 'material' | 'results';

export interface ReviewWorkspaceHandle {
  handleEscape(): boolean;
  focusInitial(): void;
}

function download(name: string, content: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function FileRow({
  file,
  selected,
  onChange,
}: {
  readonly file: ReviewSourceFileDescriptor;
  readonly selected: boolean;
  readonly onChange: (selected: boolean) => void;
}) {
  return (
    <li className="review-file-row">
      <label>
        <input
          checked={selected}
          disabled={!file.eligible}
          onChange={(event) => onChange(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          <strong>{file.path}</strong>
          <small>
            {file.role} · {file.availability}
            {file.byteLength === undefined
              ? ''
              : ` · ${new Intl.NumberFormat().format(file.byteLength)} bytes`}
          </small>
          {file.exclusionReason === undefined ? null : (
            <small>{file.exclusionReason}</small>
          )}
          {file.changes.length === 0 ? null : (
            <small>
              {file.changes
                .map(({ status, commitId }) => `${status}@${shortId(commitId)}`)
                .join(', ')}
            </small>
          )}
        </span>
      </label>
    </li>
  );
}

function ModelsEditor({
  models,
  onChange,
}: {
  readonly models: ReviewModelConfiguration | undefined;
  readonly onChange: (models: ReviewModelConfiguration | undefined) => void;
}) {
  if (models === undefined) {
    return (
      <button
        onClick={() =>
          onChange({
            analysis: { provider: '', model: '' },
            integrator: { provider: '', model: '' },
            postCheck: { provider: '', model: '' },
          })
        }
        type="button"
      >
        Configure Injected Provider Models
      </button>
    );
  }
  return (
    <fieldset className="review-fieldset">
      <legend>Injected provider model settings</legend>
      {(['analysis', 'integrator', 'postCheck'] as const).map((stage) => (
        <div className="review-model-row" key={stage}>
          <label>
            {stage} provider
            <input
              autoComplete="off"
              name={`${stage}-provider`}
              onChange={(event) =>
                onChange({
                  ...models,
                  [stage]: {
                    ...models[stage],
                    provider: event.currentTarget.value,
                  },
                })
              }
              spellCheck={false}
              value={models[stage].provider}
            />
          </label>
          <label>
            {stage} model
            <input
              autoComplete="off"
              name={`${stage}-model`}
              onChange={(event) =>
                onChange({
                  ...models,
                  [stage]: {
                    ...models[stage],
                    model: event.currentTarget.value,
                  },
                })
              }
              spellCheck={false}
              value={models[stage].model}
            />
          </label>
        </div>
      ))}
      <button onClick={() => onChange(undefined)} type="button">
        Clear Model Settings
      </button>
    </fieldset>
  );
}

function TemplatesEditor({
  templates,
  onChange,
}: {
  readonly templates: ReviewTemplates;
  readonly onChange: (templates: ReviewTemplates) => void;
}) {
  return (
    <details className="review-advanced">
      <summary>Advanced templates</summary>
      <p>
        Placeholders use REVIEW1’s single-pass renderer. Integrator and
        post-check previews remain templates until dependency outputs exist.
      </p>
      {(['common', 'analysis', 'integrator', 'postCheck'] as const).map(
        (key) => (
          <label key={key}>
            {key === 'postCheck' ? 'Post-check' : key} ·{' '}
            {templates[key].version}
            <textarea
              autoComplete="off"
              name={`${key}-template`}
              onChange={(event) =>
                onChange({
                  ...templates,
                  [key]: { ...templates[key], text: event.currentTarget.value },
                })
              }
              rows={key === 'common' ? 8 : 12}
              value={templates[key].text}
            />
          </label>
        ),
      )}
    </details>
  );
}

export const ReviewWorkspace = forwardRef<
  ReviewWorkspaceHandle,
  { readonly active: boolean; readonly controller: AiReviewController }
>(function ReviewWorkspace({ active, controller }, ref) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [view, setView] = useState<ReviewView>('setup');
  const [historyOpen, setHistoryOpen] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? !window.matchMedia('(max-width: 560px)').matches
      : true,
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [fixtureState, setFixtureState] = useState<
    'idle' | 'loading' | 'failed'
  >('idle');
  const [fixtureError, setFixtureError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      handleEscape() {
        if (state.importPreview !== undefined) {
          controller.dismissImportPreview();
          return true;
        }
        if (deleteConfirmation) {
          setDeleteConfirmation(false);
          return true;
        }
        return false;
      },
      focusInitial() {
        headingRef.current?.focus();
      },
    }),
    [controller, deleteConfirmation, state.importPreview],
  );

  useEffect(() => {
    if (active) headingRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const narrow = window.matchMedia('(max-width: 560px)');
    const collapseForNarrowWindow = ({ matches }: MediaQueryListEvent) => {
      if (matches) setHistoryOpen(false);
    };
    narrow.addEventListener('change', collapseForNarrowWindow);
    return () => narrow.removeEventListener('change', collapseForNarrowWindow);
  }, []);

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;
    await controller.previewRunImport(file.name, await file.text());
  }

  function openHistory(summary: ReviewHistorySummary) {
    void controller.openHistory(summary.id).then(() => {
      setView(summary.kind === 'run' ? 'results' : 'material');
    });
  }

  function updateCompilerPolicy(
    key: 'analysis' | 'integrator' | 'postCheck',
    checked: boolean,
  ) {
    controller.updateSetup({
      compilerPolicy: { ...state.setup.compilerPolicy, [key]: checked },
    });
  }

  const capturedSource = state.draftSource;
  const manifest =
    capturedSource?.mode === 'captured-git-history'
      ? capturedSource.captureManifest
      : undefined;
  const selectedRun = state.run;
  const canRun =
    state.modelAvailable &&
    state.setup.models !== undefined &&
    Object.values(state.setup.models).every(
      ({ provider, model }) => provider.trim() !== '' && model.trim() !== '',
    ) &&
    capturedSource !== undefined;

  return (
    <section
      aria-labelledby="review-workspace-title"
      className="review-workspace"
      hidden={!active}
    >
      <div
        className={`review-layout${historyOpen ? '' : ' review-layout--history-collapsed'}`}
      >
        <aside className="review-history" aria-label="Local review history">
          <div className="review-history__heading">
            <h2>Local History</h2>
            <button
              aria-expanded={historyOpen}
              aria-label={
                historyOpen
                  ? 'Collapse review history'
                  : 'Expand review history'
              }
              onClick={() => setHistoryOpen((value) => !value)}
              type="button"
            >
              {historyOpen ? 'Collapse' : 'History'}
            </button>
          </div>
          {historyOpen ? (
            <>
              <button
                className="review-new-button"
                onClick={() => {
                  controller.newReview();
                  setView('setup');
                }}
                type="button"
              >
                New Review
              </button>
              <p className="review-storage-note">
                {state.storageDurability === 'desktop-app-local'
                  ? 'Saved in private app-local review history.'
                  : 'Browser session only — closes with this tab.'}
              </p>
              <ul className="review-history__list">
                {state.history.summaries.map((summary) => (
                  <li key={summary.id}>
                    <button
                      aria-current={
                        state.selectedDescriptor?.id === summary.id
                          ? 'page'
                          : undefined
                      }
                      onClick={() => openHistory(summary)}
                      type="button"
                    >
                      <strong>{summary.title}</strong>
                      <span>
                        {summary.kind === 'run' ? summary.state : 'prepared'} ·{' '}
                        {summary.workspaceLabel}
                      </span>
                      <time dateTime={summary.updatedAt}>
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(summary.updatedAt))}
                      </time>
                    </button>
                  </li>
                ))}
              </ul>
              {state.history.summaries.length === 0 ? (
                <p className="review-empty">No saved reviews yet.</p>
              ) : null}
              {state.history.issues.length === 0 ? null : (
                <details className="review-history__issues">
                  <summary>
                    {state.history.issues.length} history issue(s)
                  </summary>
                  <ul>
                    {state.history.issues.map((issue) => (
                      <li key={issue.id}>
                        {issue.id}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : null}
        </aside>

        <div className="review-main">
          <header className="review-panel-header">
            <div>
              <p className="eyebrow">Local, source-backed workflow</p>
              <h1 id="review-workspace-title" ref={headingRef} tabIndex={-1}>
                AI Review
              </h1>
            </div>
            <div className="review-panel-header__actions">
              <label className="button-like">
                Import Run JSON
                <input
                  accept="application/json,.json"
                  onChange={(event) => void chooseImport(event)}
                  type="file"
                />
              </label>
              {import.meta.env.DEV ? (
                <button
                  disabled={fixtureState === 'loading'}
                  onClick={async () => {
                    setFixtureState('loading');
                    setFixtureError(undefined);
                    try {
                      const { createSyntheticReviewFixtureJson } =
                        await import('./synthetic-qa-fixture');
                      await controller.previewRunImport(
                        'synthetic-review-run-v1.json',
                        await createSyntheticReviewFixtureJson(),
                      );
                      setFixtureState('idle');
                    } catch (error) {
                      setFixtureState('failed');
                      setFixtureError(
                        `Synthetic fixture could not be prepared: ${error instanceof Error ? error.message : String(error)}`,
                      );
                    }
                  }}
                  type="button"
                >
                  {fixtureState === 'loading'
                    ? 'Preparing Synthetic Fixture…'
                    : 'Load Synthetic QA Fixture'}
                </button>
              ) : null}
              {state.selectedEntry === undefined ? null : (
                <button
                  onClick={() => setDeleteConfirmation(true)}
                  type="button"
                >
                  Remove
                </button>
              )}
            </div>
          </header>
          {fixtureError === undefined ? null : (
            <p className="review-error" role="status">
              {fixtureError}
            </p>
          )}

          <nav className="review-tablist" aria-label="AI Review workspace">
            {(['setup', 'material', 'results'] as const).map((candidate) => (
              <button
                aria-current={view === candidate ? 'page' : undefined}
                key={candidate}
                onClick={() => setView(candidate)}
                type="button"
              >
                {candidate === 'material'
                  ? 'Material & Prompts'
                  : candidate[0]!.toUpperCase() + candidate.slice(1)}
              </button>
            ))}
          </nav>

          <div className="review-status" aria-live="polite">
            <span>{state.sourceMessage}</span>
            <span>Storage: {state.saveState}</span>
          </div>
          {state.storageMessage === undefined ? null : (
            <p className="review-warning">{state.storageMessage}</p>
          )}
          {state.notice === undefined ? null : (
            <p className="review-notice">{state.notice}</p>
          )}
          {state.error === undefined ? null : (
            <p className="review-error" role="alert">
              {state.error}
            </p>
          )}

          <div className="review-main__scroll">
            {view === 'setup' ? (
              <div className="review-section">
                <div className="review-section-heading">
                  <div>
                    <p className="eyebrow">1. Prepare committed evidence</p>
                    <h2>Setup</h2>
                  </div>
                  <p>
                    {state.workspace === undefined
                      ? 'No authorized workspace'
                      : state.workspace.label}
                  </p>
                </div>
                <div className="review-form-grid">
                  <label>
                    Review title (optional)
                    <input
                      autoComplete="off"
                      name="review-title"
                      onChange={(event) =>
                        controller.updateSetup({
                          title: event.currentTarget.value,
                        })
                      }
                      placeholder="e.g. Parser boundary review…"
                      value={state.setup.title}
                    />
                  </label>
                  <label>
                    Last first-parent commits
                    <input
                      inputMode="numeric"
                      max={10}
                      min={1}
                      name="review-commit-count"
                      onChange={(event) =>
                        controller.setCommitCount(
                          event.currentTarget.valueAsNumber,
                        )
                      }
                      type="number"
                      value={state.setup.commitCount}
                    />
                  </label>
                </div>
                <p>
                  The last N first-parent commits are selected before file
                  filtering. Capture uses committed content at the pinned HEAD,
                  including unpushed commits and excluding staged, unstaged, and
                  untracked content.
                </p>
                <button
                  disabled={!state.sourceAvailable || state.captureBusy}
                  onClick={() => void controller.prepareHistory()}
                  type="button"
                >
                  {state.preparation === undefined
                    ? 'Prepare History'
                    : 'Refresh Prepared Range'}
                </button>

                {state.preparation === undefined ? null : (
                  <section className="review-preparation-summary">
                    <h3>Pinned Range</h3>
                    <dl>
                      <div>
                        <dt>Branch</dt>
                        <dd>
                          {state.preparation.branchName ?? 'detached HEAD'}
                        </dd>
                      </div>
                      <div>
                        <dt>Base</dt>
                        <dd>
                          <code
                            translate="no"
                            title={state.preparation.baseCommitId}
                          >
                            {shortId(state.preparation.baseCommitId)}
                          </code>
                        </dd>
                      </div>
                      <div>
                        <dt>Head</dt>
                        <dd>
                          <code
                            translate="no"
                            title={state.preparation.headCommitId}
                          >
                            {shortId(state.preparation.headCommitId)}
                          </code>
                        </dd>
                      </div>
                      <div>
                        <dt>Order</dt>
                        <dd>oldest to newest · first parent</dd>
                      </div>
                    </dl>
                    <ol className="review-commit-list">
                      {state.preparation.commits.map((commit) => (
                        <li key={commit.commitId}>
                          <code translate="no" title={commit.commitId}>
                            {shortId(commit.commitId)}
                          </code>
                        </li>
                      ))}
                    </ol>
                    {state.preparation.workingTreeWarning ===
                    undefined ? null : (
                      <p className="review-warning">
                        {state.preparation.workingTreeWarning}
                      </p>
                    )}

                    <div className="review-file-heading">
                      <h3>Changed Markdown Files</h3>
                      <button
                        onClick={() => controller.selectEligibleChangedFiles()}
                        type="button"
                      >
                        Select Eligible Changed Files
                      </button>
                    </div>
                    <ul className="review-file-list">
                      {state.preparation.changedFiles.map((file) => (
                        <FileRow
                          file={file}
                          key={file.path}
                          onChange={(selected) =>
                            controller.setPathSelected(file.path, selected)
                          }
                          selected={state.selectedPaths.includes(file.path)}
                        />
                      ))}
                    </ul>

                    <form
                      className="review-context-search"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void controller.searchContext(
                          String(data.get('review-context-query') ?? ''),
                        );
                      }}
                    >
                      <label>
                        Search additional context files
                        <input
                          autoComplete="off"
                          defaultValue={state.contextQuery}
                          name="review-context-query"
                          placeholder="e.g. terminology…"
                          type="search"
                        />
                      </label>
                      <button type="submit">Search Pinned Tree</button>
                    </form>
                    <ul className="review-file-list">
                      {state.contextFiles.map((file) => (
                        <FileRow
                          file={file}
                          key={file.path}
                          onChange={(selected) =>
                            controller.setPathSelected(file.path, selected)
                          }
                          selected={state.selectedPaths.includes(file.path)}
                        />
                      ))}
                    </ul>
                    {state.contextNextCursor === undefined ? null : (
                      <button
                        onClick={() =>
                          void controller.searchContext(
                            state.contextQuery,
                            true,
                          )
                        }
                        type="button"
                      >
                        Load More Context Files
                      </button>
                    )}
                    <div className="review-capture-actions">
                      <strong>{state.selectedPaths.length} selected</strong>
                      <button
                        disabled={
                          state.captureBusy || state.selectedPaths.length === 0
                        }
                        onClick={() => void controller.captureSelectedFiles()}
                        type="button"
                      >
                        Capture Selected Files
                      </button>
                      {state.captureBusy ? (
                        <button
                          onClick={() => controller.cancelCapture()}
                          type="button"
                        >
                          Cancel Capture
                        </button>
                      ) : null}
                      {state.captureProgress === undefined ? null : (
                        <span>Capture: {state.captureProgress}</span>
                      )}
                    </div>
                  </section>
                )}

                <label className="review-request-field">
                  Additional request (optional)
                  <textarea
                    autoComplete="off"
                    name="review-additional-request"
                    onChange={(event) =>
                      controller.updateSetup({
                        additionalRequest: event.currentTarget.value,
                      })
                    }
                    placeholder="Add a specific question or scope…"
                    rows={5}
                    value={state.setup.additionalRequest}
                  />
                </label>
                <TemplatesEditor
                  onChange={(templates) =>
                    controller.updateSetup({ templates })
                  }
                  templates={state.setup.templates}
                />

                <fieldset className="review-fieldset">
                  <legend>Compiler placement</legend>
                  <p>
                    {state.compilerAvailable
                      ? 'An injected read-only compiler provider is available.'
                      : 'Compiler binding is unavailable in production for this task.'}
                  </p>
                  {(['analysis', 'integrator', 'postCheck'] as const).map(
                    (key) => (
                      <label className="review-check" key={key}>
                        <input
                          checked={state.setup.compilerPolicy[key]}
                          disabled={!state.compilerAvailable}
                          onChange={(event) =>
                            updateCompilerPolicy(
                              key,
                              event.currentTarget.checked,
                            )
                          }
                          type="checkbox"
                        />
                        {key === 'postCheck' ? 'Optional post-check' : key}
                      </label>
                    ),
                  )}
                </fieldset>
                {state.modelAvailable ? (
                  <ModelsEditor
                    models={state.setup.models}
                    onChange={(models) => controller.updateSetup({ models })}
                  />
                ) : (
                  <p className="review-provider-unavailable">
                    Live analysis is not connected. You can capture, inspect,
                    save, export, and read imported results without a model
                    call.
                  </p>
                )}
                <div className="review-primary-actions">
                  <button
                    disabled={state.draftSource === undefined}
                    onClick={() => controller.refreshPromptPreviews()}
                    type="button"
                  >
                    Render Prompt Previews
                  </button>
                  <button
                    disabled={
                      state.draftSource === undefined ||
                      state.saveState === 'saving'
                    }
                    onClick={() => void controller.savePreparation()}
                    type="button"
                  >
                    Save Prepared Review
                  </button>
                  <button
                    disabled={!canRun}
                    onClick={() => void controller.startRun()}
                    type="button"
                    title={
                      canRun
                        ? undefined
                        : 'Live provider and complete model settings are required.'
                    }
                  >
                    Run Positive + Negative
                  </button>
                </div>
              </div>
            ) : null}

            {view === 'material' ? (
              <div className="review-section">
                <div className="review-section-heading">
                  <div>
                    <p className="eyebrow">2. Inspect retained evidence</p>
                    <h2>Material & Prompts</h2>
                  </div>
                  <div className="review-inline-actions">
                    <button
                      disabled={state.promptPreviews === undefined}
                      onClick={() => {
                        const content = controller.exportPreparation();
                        if (content !== undefined)
                          download(
                            'prepared-ai-review.md',
                            content,
                            'text/markdown',
                          );
                      }}
                      type="button"
                    >
                      Export Prepared Material
                    </button>
                    <button
                      disabled={state.selectedEntry?.kind !== 'preparation'}
                      onClick={() => {
                        const content =
                          controller.exportSelectedPreparationJson();
                        if (content !== undefined)
                          download(
                            `${state.selectedEntry?.kind === 'preparation' ? state.selectedEntry.preparation.id : 'prepared-ai-review'}.json`,
                            content,
                            'application/json',
                          );
                      }}
                      type="button"
                    >
                      Export Preparation JSON
                    </button>
                    <button
                      disabled={state.promptPreviews === undefined}
                      onClick={() => controller.refreshPromptPreviews()}
                      type="button"
                    >
                      Refresh Prompts
                    </button>
                  </div>
                </div>
                {capturedSource === undefined ? (
                  <p className="review-empty">
                    Capture or open a saved preparation to inspect exact
                    material.
                  </p>
                ) : (
                  <>
                    <div className="review-capture-facts">
                      <span>
                        {capturedSource.selectedPaths.length} selected paths
                      </span>
                      <span>
                        {capturedSource.completeness} for selected paths
                      </span>
                      {manifest === undefined ? null : (
                        <span>
                          {new Intl.NumberFormat().format(
                            manifest.capturedByteCount,
                          )}{' '}
                          bytes
                        </span>
                      )}
                    </div>
                    {manifest?.workingTreeWarning === undefined ? null : (
                      <p className="review-warning">
                        {manifest.workingTreeWarning}
                      </p>
                    )}
                    {manifest?.headAdvanced !== true ? null : (
                      <p className="review-warning">
                        HEAD advanced after preparation. This evidence remains
                        pinned to the earlier captured objects.
                      </p>
                    )}
                    <div className="review-material-list">
                      {capturedSource.materials.map((material) => (
                        <details key={material.id}>
                          <summary>
                            {material.kind === 'source'
                              ? 'Complete HEAD source'
                              : 'Commit patch'}{' '}
                            · {material.relativePath}
                          </summary>
                          <p>
                            <code translate="no">{material.id}</code> ·{' '}
                            {new Intl.NumberFormat().format(
                              new TextEncoder().encode(material.content)
                                .byteLength,
                            )}{' '}
                            bytes
                          </p>
                          <pre>{material.content}</pre>
                        </details>
                      ))}
                    </div>
                    {state.promptPreviews === undefined ? (
                      <p className="review-warning">
                        Setup changed. Render fresh prompt previews before
                        export.
                      </p>
                    ) : (
                      <div className="review-prompt-grid">
                        <section>
                          <h3>Negative Prompt</h3>
                          <button
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                state.promptPreviews!.negative,
                              )
                            }
                            type="button"
                          >
                            Copy Negative Prompt
                          </button>
                          <pre>{state.promptPreviews.negative}</pre>
                        </section>
                        <section>
                          <h3>Positive Prompt</h3>
                          <button
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                state.promptPreviews!.positive,
                              )
                            }
                            type="button"
                          >
                            Copy Positive Prompt
                          </button>
                          <pre>{state.promptPreviews.positive}</pre>
                        </section>
                      </div>
                    )}
                    <details className="review-dependency-preview">
                      <summary>Integrator & post-check dependencies</summary>
                      <p>
                        The Integrator template requires complete retained
                        Negative and Positive outputs and their attempt IDs. The
                        optional post-check additionally requires the
                        Integration output. No placeholder output is invented
                        before execution.
                      </p>
                      <h3>Integrator Template</h3>
                      <pre>{state.setup.templates.integrator.text}</pre>
                      <h3>Post-check Template</h3>
                      <pre>{state.setup.templates.postCheck.text}</pre>
                    </details>
                  </>
                )}
              </div>
            ) : null}

            {view === 'results' ? (
              selectedRun === undefined ? (
                <div className="review-section">
                  <p className="review-empty">
                    Open or import a retained run to inspect results.
                  </p>
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="review-section">
                      Loading formatted results…
                    </div>
                  }
                >
                  <ReviewResults run={selectedRun} />
                </Suspense>
              )
            ) : null}
          </div>

          {selectedRun === undefined ? null : (
            <footer className="review-run-actions">
              <button
                onClick={() => {
                  const content = controller.exportSelectedRun('markdown');
                  if (content !== undefined)
                    download(`${selectedRun.id}.md`, content, 'text/markdown');
                }}
                type="button"
              >
                Export Run Markdown
              </button>
              <button
                onClick={() => {
                  const content = controller.exportSelectedRun('json');
                  if (content !== undefined)
                    download(
                      `${selectedRun.id}.json`,
                      content,
                      'application/json',
                    );
                }}
                type="button"
              >
                Export Run JSON
              </button>
              <button
                onClick={() => {
                  controller.duplicateRunAsPreparation();
                  setView('setup');
                }}
                type="button"
              >
                Duplicate as New Preparation
              </button>
              {state.activeRunId === selectedRun.id ? (
                <>
                  <button
                    onClick={() => void controller.retryStage('negative')}
                    type="button"
                  >
                    Retry Negative
                  </button>
                  <button
                    onClick={() => void controller.retryStage('positive')}
                    type="button"
                  >
                    Retry Positive
                  </button>
                  <button
                    disabled={
                      !['negative', 'positive'].every((stage) => {
                        const attempt = selectedRun.attempts.find(
                          ({ id }) =>
                            id ===
                            selectedRun.currentAttemptIds[
                              stage as 'negative' | 'positive'
                            ],
                        );
                        return attempt?.state === 'completed';
                      })
                    }
                    onClick={() => void controller.retryStage('integrator')}
                    type="button"
                  >
                    Retry Integrator
                  </button>
                  <button
                    disabled={
                      selectedRun.attempts.find(
                        ({ id }) =>
                          id === selectedRun.currentAttemptIds.integrator,
                      )?.state !== 'completed'
                    }
                    onClick={() => void controller.retryStage('post-check')}
                    type="button"
                  >
                    Retry Post-check
                  </button>
                  <button
                    disabled={[
                      'completed',
                      'failed',
                      'cancelled',
                      'interrupted',
                      'blocked',
                    ].includes(selectedRun.state)}
                    onClick={() => void controller.cancelRun()}
                    type="button"
                  >
                    Cancel Active Run
                  </button>
                </>
              ) : null}
            </footer>
          )}
        </div>
      </div>

      {state.importPreview === undefined ? null : (
        <section
          aria-labelledby="review-import-title"
          aria-modal="true"
          className="review-subdialog"
          role="dialog"
        >
          <div>
            <h2 id="review-import-title">Validated Run Import</h2>
            <dl>
              <div>
                <dt>File</dt>
                <dd>{state.importPreview.sourceName}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>
                  <code translate="no">{state.importPreview.run.id}</code>
                </dd>
              </div>
              <div>
                <dt>State</dt>
                <dd>{state.importPreview.run.state}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>
                  <code translate="no">
                    {state.importPreview.run.frozenInput.workspaceId}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {new Intl.NumberFormat().format(
                    state.importPreview.byteLength,
                  )}{' '}
                  bytes
                </dd>
              </div>
              <div>
                <dt>Collision</dt>
                <dd>{state.importPreview.collision}</dd>
              </div>
            </dl>
            <p>
              Import retains original provenance and does not open the vault,
              reconnect a provider, or rewrite the workspace ID.
            </p>
            <div className="review-inline-actions">
              <button
                disabled={state.importPreview.collision === 'different'}
                onClick={() => void controller.acceptRunImport()}
                type="button"
              >
                Accept Import
              </button>
              <button
                onClick={() => controller.dismissImportPreview()}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {!deleteConfirmation ? null : (
        <section
          aria-labelledby="review-delete-title"
          aria-modal="true"
          className="review-subdialog"
          role="dialog"
        >
          <div>
            <h2 id="review-delete-title">Remove This History Item?</h2>
            <p>
              This removes the app-local review record. It does not change the
              vault or theory files.
            </p>
            <div className="review-inline-actions">
              <button
                onClick={() => {
                  setDeleteConfirmation(false);
                  void controller.deleteSelected();
                }}
                type="button"
              >
                Remove Review
              </button>
              <button
                onClick={() => setDeleteConfirmation(false)}
                type="button"
              >
                Keep Review
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
});
