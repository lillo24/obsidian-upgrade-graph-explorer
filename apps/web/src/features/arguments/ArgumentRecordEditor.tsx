import type {
  ArgumentLibrary,
  HumanReviewState,
} from '@icarus-graph-explorer/argument-workspace';

import type { RetrievalEditorText } from './retrieval-editor';
import type { ArgumentRecordDraft } from './session';

const REVIEW_STATES: readonly HumanReviewState[] = [
  'draft',
  'pending-review',
  'accepted',
  'reopened',
  'rejected',
];

function MetadataEditor({
  text,
  onChange,
}: {
  readonly text: RetrievalEditorText;
  readonly onChange: (value: RetrievalEditorText) => void;
}) {
  return (
    <fieldset className="arguments-editor__fieldset">
      <legend>Retrieval metadata</legend>
      <label>
        Aliases
        <textarea
          onChange={(event) =>
            onChange({ ...text, aliases: event.currentTarget.value })
          }
          rows={2}
          value={text.aliases}
        />
      </label>
      <label>
        Keywords
        <textarea
          onChange={(event) =>
            onChange({ ...text, keywords: event.currentTarget.value })
          }
          rows={2}
          value={text.keywords}
        />
      </label>
      <label>
        Exact retrieval phrases
        <textarea
          onChange={(event) =>
            onChange({ ...text, phrases: event.currentTarget.value })
          }
          rows={2}
          value={text.phrases}
        />
      </label>
    </fieldset>
  );
}

function CheckboxList({
  empty,
  legend,
  options,
  selected,
  onChange,
}: {
  readonly empty: string;
  readonly legend: string;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly archived: boolean;
  }[];
  readonly selected: readonly string[];
  readonly onChange: (values: readonly string[]) => void;
}) {
  const selectedIds = new Set(selected);
  return (
    <fieldset className="arguments-editor__fieldset arguments-editor__checks">
      <legend>{legend}</legend>
      {options.length === 0 ? (
        <p className="arguments-empty">{empty}</p>
      ) : (
        options.map((option) => (
          <label key={option.id}>
            <input
              checked={selectedIds.has(option.id)}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
              type="checkbox"
            />
            <span>
              {option.label}
              {option.archived ? ' — archived' : ''}
            </span>
          </label>
        ))
      )}
    </fieldset>
  );
}

function CommonFields({
  draft,
  retrievalText,
  onChange,
  onRetrievalTextChange,
}: {
  readonly draft: ArgumentRecordDraft;
  readonly retrievalText: RetrievalEditorText;
  readonly onChange: (draft: ArgumentRecordDraft) => void;
  readonly onRetrievalTextChange: (value: RetrievalEditorText) => void;
}) {
  return (
    <>
      <label>
        Title <span aria-hidden="true">*</span>
        <input
          aria-required="true"
          onChange={(event) =>
            onChange({ ...draft, title: event.currentTarget.value })
          }
          value={draft.title}
        />
      </label>
      <label>
        Human review state
        <select
          onChange={(event) =>
            onChange({
              ...draft,
              reviewState: event.currentTarget.value as HumanReviewState,
            })
          }
          value={draft.reviewState}
        >
          {REVIEW_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>
      <MetadataEditor onChange={onRetrievalTextChange} text={retrievalText} />
    </>
  );
}

function SourceReferenceEditor({
  source,
  onChange,
}: {
  readonly source: string;
  readonly onChange: (source: string) => void;
}) {
  return (
    <details className="arguments-editor__advanced">
      <summary>Advanced source-reference authoring</summary>
      <p>
        JSON array of registered locators. Keep stable IDs and recorded
        metadata; the application does not invent binding hints or version
        fingerprints.
      </p>
      <label>
        Source references JSON
        <textarea
          className="arguments-editor__source-json"
          onChange={(event) => onChange(event.currentTarget.value)}
          spellCheck={false}
          value={source}
        />
      </label>
    </details>
  );
}

export function ArgumentRecordEditor({
  draft,
  errors,
  library,
  onChange,
  onRetrievalTextChange,
  onSourceChange,
  retrievalText,
  source,
}: {
  readonly draft: ArgumentRecordDraft;
  readonly errors: readonly string[];
  readonly library: ArgumentLibrary;
  readonly onChange: (draft: ArgumentRecordDraft) => void;
  readonly onRetrievalTextChange: (value: RetrievalEditorText) => void;
  readonly onSourceChange: (source: string) => void;
  readonly retrievalText: RetrievalEditorText;
  readonly source: string;
}) {
  const topics = library.topics.map((record) => ({
    id: record.id,
    label: record.title,
    archived: record.archived,
  }));
  const axioms = library.axioms.map((record) => ({
    id: record.id,
    label: record.title,
    archived: record.archived,
  }));
  const counters = library.counterArguments.map((record) => ({
    id: record.id,
    label: record.title,
    archived: record.archived,
  }));
  return (
    <form
      className="arguments-editor"
      onSubmit={(event) => event.preventDefault()}
    >
      <header>
        <p className="eyebrow">
          {draft.mode === 'create' ? 'New' : 'Edit'} {draft.kind}
        </p>
        <h2>{draft.mode === 'create' ? 'Create record' : draft.title}</h2>
        <p className="arguments-disclosure">
          Fields marked * are required. New records start as drafts unless
          changed explicitly.
        </p>
      </header>
      {errors.length === 0 ? null : (
        <div className="arguments-form-errors" role="alert">
          <strong>Review these fields:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <CommonFields
        draft={draft}
        onChange={onChange}
        onRetrievalTextChange={onRetrievalTextChange}
        retrievalText={retrievalText}
      />

      {draft.kind === 'topic' ? (
        <>
          <label>
            Summary <span aria-hidden="true">*</span>
            <textarea
              aria-required="true"
              onChange={(event) =>
                onChange({ ...draft, summary: event.currentTarget.value })
              }
              rows={6}
              value={draft.summary}
            />
          </label>
          <CheckboxList
            empty="Create an Axiom before assigning one."
            legend="Topic Axioms"
            onChange={(axiomIds) => onChange({ ...draft, axiomIds })}
            options={axioms}
            selected={draft.axiomIds}
          />
          <CheckboxList
            empty="Create a Counter-Argument before assigning one."
            legend="Topic Counter-Arguments"
            onChange={(counterArgumentIds) =>
              onChange({ ...draft, counterArgumentIds })
            }
            options={counters}
            selected={draft.counterArgumentIds}
          />
        </>
      ) : null}

      {draft.kind === 'axiom' ? (
        <>
          <label>
            Statement <span aria-hidden="true">*</span>
            <textarea
              aria-required="true"
              onChange={(event) =>
                onChange({ ...draft, statement: event.currentTarget.value })
              }
              rows={6}
              value={draft.statement}
            />
          </label>
          <label>
            Explanation
            <textarea
              onChange={(event) =>
                onChange({ ...draft, explanation: event.currentTarget.value })
              }
              rows={5}
              value={draft.explanation ?? ''}
            />
          </label>
          <label>
            Scope
            <textarea
              onChange={(event) =>
                onChange({ ...draft, scope: event.currentTarget.value })
              }
              rows={4}
              value={draft.scope ?? ''}
            />
          </label>
          <label>
            Supporting reasoning
            <textarea
              onChange={(event) =>
                onChange({
                  ...draft,
                  supportingReasoning: event.currentTarget.value,
                })
              }
              rows={6}
              value={draft.supportingReasoning ?? ''}
            />
          </label>
          <CheckboxList
            empty="No Topics are available."
            legend="Topic memberships"
            onChange={(topicIds) => onChange({ ...draft, topicIds })}
            options={topics}
            selected={draft.topicIds}
          />
          <SourceReferenceEditor onChange={onSourceChange} source={source} />
        </>
      ) : null}

      {draft.kind === 'counter-argument' ? (
        <>
          <label>
            Observation / example / argument <span aria-hidden="true">*</span>
            <textarea
              aria-required="true"
              onChange={(event) =>
                onChange({ ...draft, observation: event.currentTarget.value })
              }
              rows={7}
              value={draft.observation}
            />
          </label>
          <label>
            What this is intended to challenge <span aria-hidden="true">*</span>
            <textarea
              aria-required="true"
              onChange={(event) =>
                onChange({
                  ...draft,
                  challengedClaim: event.currentTarget.value,
                })
              }
              rows={5}
              value={draft.challengedClaim}
            />
          </label>
          <label>
            Structured target
            <select
              onChange={(event) => {
                const [kind, id] = event.currentTarget.value.split('\0');
                onChange({
                  ...draft,
                  target:
                    kind === 'topic-claim'
                      ? { kind, topicId: id! }
                      : kind === 'axiom'
                        ? { kind, axiomId: id! }
                        : kind === 'counter-argument'
                          ? { kind, counterArgumentId: id! }
                          : undefined,
                });
              }}
              value={
                draft.target === undefined
                  ? ''
                  : draft.target.kind === 'topic-claim'
                    ? `topic-claim\0${draft.target.topicId}`
                    : draft.target.kind === 'axiom'
                      ? `axiom\0${draft.target.axiomId}`
                      : `counter-argument\0${draft.target.counterArgumentId}`
              }
            >
              <option value="">No structured target</option>
              <optgroup label="Topic claims">
                {library.topics.map((topic) => (
                  <option key={topic.id} value={`topic-claim\0${topic.id}`}>
                    {topic.title}
                    {topic.archived ? ' — archived' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Axioms">
                {library.axioms.map((axiom) => (
                  <option key={axiom.id} value={`axiom\0${axiom.id}`}>
                    {axiom.title}
                    {axiom.archived ? ' — archived' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Counter-Arguments">
                {library.counterArguments
                  .filter(({ id }) => id !== draft.id)
                  .map((counter) => (
                    <option
                      key={counter.id}
                      value={`counter-argument\0${counter.id}`}
                    >
                      {counter.title}
                      {counter.archived ? ' — archived' : ''}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <CheckboxList
            empty="Create an Axiom before attaching an answer."
            legend="Answered using reusable Axioms"
            onChange={(answeringAxiomIds) =>
              onChange({ ...draft, answeringAxiomIds })
            }
            options={axioms}
            selected={draft.answeringAxiomIds}
          />
          <label>
            Recorded response — why it applies
            <textarea
              onChange={(event) =>
                onChange({
                  ...draft,
                  responseExplanation: event.currentTarget.value,
                })
              }
              rows={7}
              value={draft.responseExplanation}
            />
          </label>
          <label>
            Current outcome
            <select
              onChange={(event) =>
                onChange({
                  ...draft,
                  outcome: event.currentTarget.value as typeof draft.outcome,
                })
              }
              value={draft.outcome}
            >
              <option value="unanswered">unanswered</option>
              <option value="standing">standing</option>
              <option value="partially-addressed">partially-addressed</option>
              <option value="refuted">refuted</option>
              <option value="inapplicable-under-stated-scope">
                inapplicable-under-stated-scope
              </option>
            </select>
          </label>
          <label>
            Boundary / unresolved remainder
            <textarea
              onChange={(event) =>
                onChange({ ...draft, boundary: event.currentTarget.value })
              }
              rows={4}
              value={draft.boundary ?? ''}
            />
          </label>
          <label>
            Reopening condition
            <textarea
              onChange={(event) =>
                onChange({
                  ...draft,
                  reopeningCondition: event.currentTarget.value,
                })
              }
              rows={4}
              value={draft.reopeningCondition ?? ''}
            />
          </label>
          <CheckboxList
            empty="No Topics are available."
            legend="Topic memberships"
            onChange={(topicIds) => onChange({ ...draft, topicIds })}
            options={topics}
            selected={draft.topicIds}
          />
          <SourceReferenceEditor onChange={onSourceChange} source={source} />
        </>
      ) : null}
    </form>
  );
}
