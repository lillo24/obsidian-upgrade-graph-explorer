import type {
  ArgumentExample,
  ArgumentLibrary,
  ArgumentPremise,
  ArgumentRelation,
  ArgumentTargetPart,
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

function ExamplesEditor({
  examples,
  premises,
  onChange,
  onCreateId,
}: {
  readonly examples: readonly ArgumentExample[];
  readonly premises: readonly ArgumentPremise[];
  readonly onChange: (examples: readonly ArgumentExample[]) => void;
  readonly onCreateId: () => string;
}) {
  const referencedIds = new Set(
    premises.flatMap(({ exampleIds }) => exampleIds ?? []),
  );
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= examples.length) return;
    const reordered = [...examples];
    const [example] = reordered.splice(index, 1);
    reordered.splice(destination, 0, example!);
    onChange(reordered);
  };
  return (
    <fieldset className="arguments-editor__fieldset">
      <legend>Examples</legend>
      {examples.length === 0 ? (
        <p className="arguments-empty">No concrete Examples recorded.</p>
      ) : (
        <ol className="arguments-premise-editor">
          {examples.map((example, index) => {
            const referenced = referencedIds.has(example.id);
            return (
              <li key={example.id}>
                <div className="arguments-premise-editor__controls">
                  <code>{example.id}</code>
                  <button
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    type="button"
                  >
                    Move up
                  </button>
                  <button
                    disabled={index === examples.length - 1}
                    onClick={() => move(index, 1)}
                    type="button"
                  >
                    Move down
                  </button>
                  <button
                    disabled={referenced}
                    onClick={() =>
                      onChange(examples.filter(({ id }) => id !== example.id))
                    }
                    title={
                      referenced
                        ? 'Remove Example links from premises first.'
                        : undefined
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <label>
                  Example text
                  <textarea
                    aria-required="true"
                    onChange={(event) =>
                      onChange(
                        examples.map((current) =>
                          current.id === example.id
                            ? { ...current, text: event.currentTarget.value }
                            : current,
                        ),
                      )
                    }
                    rows={3}
                    value={example.text}
                  />
                </label>
                {referenced ? (
                  <small>Referenced by one or more premises.</small>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <button
        onClick={() => onChange([...examples, { id: onCreateId(), text: '' }])}
        type="button"
      >
        Add Example
      </button>
    </fieldset>
  );
}

function relationTargetPartValue(part: ArgumentTargetPart): string {
  return part.kind === 'premise' ? `premise\0${part.premiseId}` : part.kind;
}

function parseRelationTargetPart(value: string): ArgumentTargetPart {
  const [kind, premiseId] = value.split('\0');
  return kind === 'premise'
    ? { kind, premiseId: premiseId! }
    : {
        kind: kind as 'argument' | 'reasoning' | 'conclusion',
      };
}

function RelationsEditor({
  library,
  ownerId,
  relations,
  onChange,
  onCreateId,
}: {
  readonly library: ArgumentLibrary;
  readonly ownerId: string;
  readonly relations: readonly ArgumentRelation[];
  readonly onChange: (relations: readonly ArgumentRelation[]) => void;
  readonly onCreateId: () => string;
}) {
  const targets = library.arguments.filter(({ id }) => id !== ownerId);
  const replace = (index: number, relation: ArgumentRelation) =>
    onChange(
      relations.map((current, currentIndex) =>
        currentIndex === index ? relation : current,
      ),
    );
  return (
    <fieldset className="arguments-editor__fieldset">
      <legend>Argument relations</legend>
      {relations.length === 0 ? (
        <p className="arguments-empty">No attack or support relation.</p>
      ) : (
        <ol className="arguments-premise-editor">
          {relations.map((relation, index) => {
            const target = library.arguments.find(
              ({ id }) => id === relation.targetArgumentId,
            )!;
            return (
              <li key={relation.id}>
                <div className="arguments-premise-editor__controls">
                  <code>{relation.id}</code>
                  <button
                    onClick={() =>
                      onChange(relations.filter(({ id }) => id !== relation.id))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <label>
                  Relation
                  <select
                    onChange={(event) =>
                      replace(index, {
                        ...relation,
                        kind: event.currentTarget.value as 'attack' | 'support',
                      })
                    }
                    value={relation.kind}
                  >
                    <option value="attack">Attacks</option>
                    <option value="support">Supports</option>
                  </select>
                </label>
                <label>
                  Target Argument
                  <select
                    onChange={(event) => {
                      const nextTarget = library.arguments.find(
                        ({ id }) => id === event.currentTarget.value,
                      )!;
                      replace(index, {
                        ...relation,
                        targetArgumentId: nextTarget.id,
                        targetPart: { kind: 'argument' },
                        reliedOnRevision: nextTarget.revision,
                      });
                    }}
                    value={relation.targetArgumentId}
                  >
                    {targets.map((argument) => (
                      <option key={argument.id} value={argument.id}>
                        {argument.title} — revision {argument.revision}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Target part
                  <select
                    onChange={(event) =>
                      replace(index, {
                        ...relation,
                        targetPart: parseRelationTargetPart(
                          event.currentTarget.value,
                        ),
                      })
                    }
                    value={relationTargetPartValue(relation.targetPart)}
                  >
                    <option value="argument">Whole Argument</option>
                    {target.premises.map((premise, premiseIndex) => (
                      <option key={premise.id} value={`premise\0${premise.id}`}>
                        Premise {premiseIndex + 1} — {premise.id}
                      </option>
                    ))}
                    {target.reasoning === undefined ? null : (
                      <option value="reasoning">Reasoning</option>
                    )}
                    <option value="conclusion">Conclusion</option>
                  </select>
                </label>
                <small>
                  Relied-on revision: {relation.reliedOnRevision}. Target
                  changes mark this relation stale without retargeting it.
                </small>
              </li>
            );
          })}
        </ol>
      )}
      <button
        disabled={targets.length === 0}
        onClick={() => {
          const target = targets[0];
          if (target === undefined) return;
          onChange([
            ...relations,
            {
              id: onCreateId(),
              kind: 'attack',
              targetArgumentId: target.id,
              targetPart: { kind: 'argument' },
              reliedOnRevision: target.revision,
            },
          ]);
        }}
        type="button"
      >
        Add relation
      </button>
    </fieldset>
  );
}

function PremiseEditor({
  examples,
  library,
  premises,
  ownerId,
  onChange,
  onCreateId,
}: {
  readonly examples: readonly ArgumentExample[];
  readonly library: ArgumentLibrary;
  readonly premises: readonly ArgumentPremise[];
  readonly ownerId: string;
  readonly onChange: (premises: readonly ArgumentPremise[]) => void;
  readonly onCreateId: () => string;
}) {
  const replace = (index: number, premise: ArgumentPremise) =>
    onChange(
      premises.map((current, itemIndex) =>
        itemIndex === index ? premise : current,
      ),
    );
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= premises.length) return;
    const reordered = [...premises];
    const [premise] = reordered.splice(index, 1);
    reordered.splice(destination, 0, premise!);
    onChange(reordered);
  };
  return (
    <fieldset className="arguments-editor__fieldset">
      <legend>Ordered premises</legend>
      {premises.length === 0 ? (
        <p className="arguments-empty">No premises recorded.</p>
      ) : (
        <ol className="arguments-premise-editor">
          {premises.map((premise, index) => (
            <li key={premise.id}>
              <div className="arguments-premise-editor__controls">
                <code>{premise.id}</code>
                <button
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  type="button"
                >
                  Move up
                </button>
                <button
                  disabled={index === premises.length - 1}
                  onClick={() => move(index, 1)}
                  type="button"
                >
                  Move down
                </button>
                <button
                  onClick={() =>
                    onChange(premises.filter(({ id }) => id !== premise.id))
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
              <label>
                Premise kind
                <select
                  onChange={(event) => {
                    const kind = event.currentTarget.value;
                    if (kind === premise.kind) return;
                    const exampleIds = premise.exampleIds;
                    if (kind === 'axiom') {
                      const axiom = library.axioms[0];
                      if (axiom !== undefined) {
                        replace(index, {
                          id: premise.id,
                          kind,
                          axiomId: axiom.id,
                          reliedOnRevision: axiom.revision,
                          ...(exampleIds === undefined ? {} : { exampleIds }),
                        });
                      }
                    } else if (kind === 'argument-conclusion') {
                      const argument = library.arguments.find(
                        ({ id }) => id !== ownerId,
                      );
                      if (argument !== undefined) {
                        replace(index, {
                          id: premise.id,
                          kind,
                          argumentId: argument.id,
                          reliedOnRevision: argument.revision,
                          ...(exampleIds === undefined ? {} : { exampleIds }),
                        });
                      }
                    } else if (kind === 'argument-premise') {
                      const argument = library.arguments.find(
                        ({ id, premises: candidatePremises }) =>
                          id !== ownerId && candidatePremises.length > 0,
                      );
                      const referencedPremise = argument?.premises[0];
                      if (
                        argument !== undefined &&
                        referencedPremise !== undefined
                      ) {
                        replace(index, {
                          id: premise.id,
                          kind,
                          argumentId: argument.id,
                          premiseId: referencedPremise.id,
                          reliedOnRevision: argument.revision,
                          ...(exampleIds === undefined ? {} : { exampleIds }),
                        });
                      }
                    } else {
                      replace(index, {
                        id: premise.id,
                        kind: 'text',
                        text: '',
                        ...(exampleIds === undefined ? {} : { exampleIds }),
                      });
                    }
                  }}
                  value={premise.kind}
                >
                  <option value="text">Authored text</option>
                  <option disabled={library.axioms.length === 0} value="axiom">
                    Axiom reference
                  </option>
                  <option
                    disabled={library.arguments.every(
                      ({ id }) => id === ownerId,
                    )}
                    value="argument-conclusion"
                  >
                    Prior Argument conclusion
                  </option>
                  <option
                    disabled={library.arguments.every(
                      ({ id, premises: candidatePremises }) =>
                        id === ownerId || candidatePremises.length === 0,
                    )}
                    value="argument-premise"
                  >
                    Prior Argument premise
                  </option>
                </select>
              </label>
              {premise.kind === 'text' ? (
                <label>
                  Premise text
                  <textarea
                    aria-required="true"
                    onChange={(event) =>
                      replace(index, {
                        ...premise,
                        text: event.currentTarget.value,
                      })
                    }
                    rows={3}
                    value={premise.text}
                  />
                </label>
              ) : premise.kind === 'axiom' ? (
                <label>
                  Referenced Axiom
                  <select
                    onChange={(event) => {
                      const axiom = library.axioms.find(
                        ({ id }) => id === event.currentTarget.value,
                      )!;
                      replace(index, {
                        ...premise,
                        axiomId: axiom.id,
                        reliedOnRevision: axiom.revision,
                      });
                    }}
                    value={premise.axiomId}
                  >
                    {library.axioms.map((axiom) => (
                      <option key={axiom.id} value={axiom.id}>
                        {axiom.title} — revision {axiom.revision}
                      </option>
                    ))}
                  </select>
                </label>
              ) : premise.kind === 'argument-conclusion' ? (
                <label>
                  Referenced Argument conclusion
                  <select
                    onChange={(event) => {
                      const argument = library.arguments.find(
                        ({ id }) => id === event.currentTarget.value,
                      )!;
                      replace(index, {
                        ...premise,
                        argumentId: argument.id,
                        reliedOnRevision: argument.revision,
                      });
                    }}
                    value={premise.argumentId}
                  >
                    {library.arguments
                      .filter(({ id }) => id !== ownerId)
                      .map((argument) => (
                        <option key={argument.id} value={argument.id}>
                          {argument.title} — revision {argument.revision}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Source Argument
                    <select
                      onChange={(event) => {
                        const argument = library.arguments.find(
                          ({ id }) => id === event.currentTarget.value,
                        )!;
                        replace(index, {
                          ...premise,
                          argumentId: argument.id,
                          premiseId: argument.premises[0]!.id,
                          reliedOnRevision: argument.revision,
                        });
                      }}
                      value={premise.argumentId}
                    >
                      {library.arguments
                        .filter(
                          ({ id, premises: candidatePremises }) =>
                            id !== ownerId && candidatePremises.length > 0,
                        )
                        .map((argument) => (
                          <option key={argument.id} value={argument.id}>
                            {argument.title} — revision {argument.revision}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Source premise
                    <select
                      onChange={(event) =>
                        replace(index, {
                          ...premise,
                          premiseId: event.currentTarget.value,
                        })
                      }
                      value={premise.premiseId}
                    >
                      {library.arguments
                        .find(({ id }) => id === premise.argumentId)!
                        .premises.map((candidate, candidateIndex) => (
                          <option key={candidate.id} value={candidate.id}>
                            Premise {candidateIndex + 1} — {candidate.id}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {examples.length === 0 ? null : (
                <fieldset className="arguments-editor__checks">
                  <legend>Grounded in local Examples</legend>
                  {examples.map((example) => (
                    <label key={example.id}>
                      <input
                        checked={
                          premise.exampleIds?.includes(example.id) ?? false
                        }
                        onChange={(event) => {
                          const selected = premise.exampleIds ?? [];
                          const exampleIds = event.currentTarget.checked
                            ? [...selected, example.id]
                            : selected.filter((id) => id !== example.id);
                          replace(index, {
                            ...premise,
                            exampleIds,
                          });
                        }}
                        type="checkbox"
                      />
                      <span>
                        <code>{example.id}</code> — {example.text}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {premise.kind === 'text' ? null : (
                <small>
                  Relied-on revision: {premise.reliedOnRevision}. Changing the
                  referenced record later marks this premise stale.
                </small>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="arguments-actions">
        <button
          onClick={() =>
            onChange([
              ...premises,
              { id: onCreateId(), kind: 'text', text: '' },
            ])
          }
          type="button"
        >
          Add premise
        </button>
      </div>
    </fieldset>
  );
}

export function ArgumentRecordEditor({
  draft,
  errors,
  library,
  onChange,
  onCreateExampleId,
  onCreatePremiseId,
  onCreateRelationId,
  onRetrievalTextChange,
  onSourceChange,
  retrievalText,
  source,
}: {
  readonly draft: ArgumentRecordDraft;
  readonly errors: readonly string[];
  readonly library: ArgumentLibrary;
  readonly onChange: (draft: ArgumentRecordDraft) => void;
  readonly onCreateExampleId: () => string;
  readonly onCreatePremiseId: () => string;
  readonly onCreateRelationId: () => string;
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
  const argumentOptions = library.arguments.map((record) => ({
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
            empty="Create an Argument before assigning one."
            legend="Topic Arguments"
            onChange={(argumentIds) => onChange({ ...draft, argumentIds })}
            options={argumentOptions}
            selected={draft.argumentIds}
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

      {draft.kind === 'argument' ? (
        <>
          <ExamplesEditor
            examples={draft.examples}
            onChange={(examples) => onChange({ ...draft, examples })}
            onCreateId={onCreateExampleId}
            premises={draft.premises}
          />
          <PremiseEditor
            examples={draft.examples}
            library={library}
            onChange={(premises) => onChange({ ...draft, premises })}
            onCreateId={onCreatePremiseId}
            ownerId={draft.id}
            premises={draft.premises}
          />
          <label>
            Reasoning
            <textarea
              onChange={(event) =>
                onChange({ ...draft, reasoning: event.currentTarget.value })
              }
              rows={7}
              value={draft.reasoning ?? ''}
            />
          </label>
          <label>
            Conclusion <span aria-hidden="true">*</span>
            <textarea
              aria-required="true"
              onChange={(event) =>
                onChange({ ...draft, conclusion: event.currentTarget.value })
              }
              rows={5}
              value={draft.conclusion}
            />
          </label>
          <label>
            Boundary / Invariance
            <textarea
              onChange={(event) =>
                onChange({ ...draft, boundary: event.currentTarget.value })
              }
              rows={4}
              value={draft.boundary ?? ''}
            />
          </label>
          <RelationsEditor
            library={library}
            onChange={(relations) => onChange({ ...draft, relations })}
            onCreateId={onCreateRelationId}
            ownerId={draft.id}
            relations={draft.relations}
          />
          <label>
            Supersedes Argument
            <select
              onChange={(event) =>
                onChange({
                  ...draft,
                  supersedesArgumentId:
                    event.currentTarget.value === ''
                      ? undefined
                      : event.currentTarget.value,
                })
              }
              value={draft.supersedesArgumentId ?? ''}
            >
              <option value="">No predecessor selected</option>
              {library.arguments
                .filter(({ id }) => id !== draft.id)
                .map((argument) => (
                  <option key={argument.id} value={argument.id}>
                    {argument.title}
                    {argument.archived ? ' — archived' : ''}
                  </option>
                ))}
            </select>
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
                const [kind, id, partKind, premiseId] =
                  event.currentTarget.value.split('\0');
                onChange({
                  ...draft,
                  target:
                    kind === 'topic-claim'
                      ? { kind, topicId: id! }
                      : kind === 'axiom'
                        ? { kind, axiomId: id! }
                        : kind === 'counter-argument'
                          ? { kind, counterArgumentId: id! }
                          : kind === 'argument' && partKind !== undefined
                            ? {
                                kind,
                                argumentId: id!,
                                part:
                                  partKind === 'premise'
                                    ? { kind: partKind, premiseId: premiseId! }
                                    : {
                                        kind: partKind as
                                          | 'argument'
                                          | 'reasoning'
                                          | 'conclusion',
                                      },
                              }
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
                      : draft.target.kind === 'counter-argument'
                        ? `counter-argument\0${draft.target.counterArgumentId}`
                        : `argument\0${draft.target.argumentId}\0${draft.target.part.kind}${
                            draft.target.part.kind === 'premise'
                              ? `\0${draft.target.part.premiseId}`
                              : ''
                          }`
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
              <optgroup label="Arguments">
                {library.arguments.flatMap((argument) => [
                  <option
                    key={`${argument.id}-whole`}
                    value={`argument\0${argument.id}\0argument`}
                  >
                    {argument.title} — whole Argument
                  </option>,
                  ...argument.premises.map((premise, index) => (
                    <option
                      key={`${argument.id}-${premise.id}`}
                      value={`argument\0${argument.id}\0premise\0${premise.id}`}
                    >
                      {argument.title} — premise {index + 1}
                    </option>
                  )),
                  ...(argument.reasoning === undefined
                    ? []
                    : [
                        <option
                          key={`${argument.id}-reasoning`}
                          value={`argument\0${argument.id}\0reasoning`}
                        >
                          {argument.title} — reasoning
                        </option>,
                      ]),
                  <option
                    key={`${argument.id}-conclusion`}
                    value={`argument\0${argument.id}\0conclusion`}
                  >
                    {argument.title} — conclusion
                  </option>,
                ])}
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
