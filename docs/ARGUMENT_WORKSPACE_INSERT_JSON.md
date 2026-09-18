# Argument Workspace Insert JSON

Argument Workspace has two deliberately separate JSON workflows:

- **Import Library JSON** exchanges a complete canonical library snapshot and
  retains its merge, replacement, lineage, migration, and collision rules.
- **Insert JSON** is a small additive authoring transaction. It creates records,
  adds Topic memberships, and can explicitly promote an accepted Argument to
  Current without supplying library metadata.

Insert JSON is useful for payloads drafted by an external assistant, but the
payload is not trusted or written automatically. A user may select a local
`.json` file (up to 5 MiB) or paste the document manually, inspect the
non-mutating preview, and confirm the snapshot-bound transaction. A selected
file is loaded into the same editable text area as pasted JSON. This does not
add a write tool to AI Review or the Compiler interface.

## Format

The root `format` is required and must be
`argument-workspace-insert-v1`. The seven arrays are optional and default to
empty, but the document must contain at least one record or operation.

```json
{
  "format": "argument-workspace-insert-v1",
  "topics": [],
  "contexts": [],
  "axioms": [],
  "arguments": [],
  "counterArguments": [],
  "memberships": [],
  "currentPromotions": []
}
```

Record fields follow the existing Topic, Context, Axiom, Argument, and Counter-Argument
create inputs. The payload does not accept `libraryId`, schema/library revision,
fingerprints, timestamps, record revisions, or archive state; the authoring
transaction assigns those canonical fields. Every new record must have an
explicit stable ID. Argument Examples, Premises, and relations also require
explicit IDs so same-payload references are deterministic. Contexts may name
one `parentContextId` and ordered direct `axiomIds`; Arguments may attach them
through `contextIds`. These references may target existing records or records
created in the same payload.

`memberships` supports the existing `axiom`, `argument`, and
`counter-argument` kinds. V1 is additive: omit `present` or set it to `true`.
Removal and general edit/delete patches are intentionally unsupported.

`currentPromotions` is optional and explicit. The Argument must already belong
to the Topic after the transaction and must be accepted and non-archived.
Insertion never promotes an Argument merely because it is present in the
payload. Existing predecessor/supersession behavior is retained, and Current
does not mean true or proven.

## Revision pins and references

Argument premise and relation references, plus Counter-Argument answering-Axiom
references, may omit `reliedOnRevision`. Preview resolves each target against
the exact final transaction candidate and records that revision in the
canonical object. An explicitly supplied revision must equal the resolved
revision or validation fails; it is never silently replaced.

References may point to an existing record or to another record created by the
same payload. The complete candidate is validated together, so JSON array order
does not control dependency resolution. Inference-premise, supersession, and
Context-inheritance cycles fail. Context inheritance remains separate from the
inference graph, and attack/support cycles remain valid debate structure.

Preview rejects unknown fields, duplicate or colliding IDs, missing Examples or
record references, malformed target parts, invalid promotions, invalid source
reference ownership, and other ordinary library validation failures. Preview
does not write. Confirmation succeeds only if the current library still matches
the preview descriptor and persists the complete candidate once; a stale
preview must be recomputed.

## Neutral example

```json
{
  "format": "argument-workspace-insert-v1",
  "topics": [
    {
      "id": "TOP-DEMO",
      "title": "Demo Topic",
      "summary": "Synthetic insert acceptance topic",
      "reviewState": "accepted"
    }
  ],
  "arguments": [
    {
      "id": "ARG-DEMO-A1",
      "title": "Original explanation",
      "examples": [
        { "id": "EX-A", "text": "Example A" },
        { "id": "EX-B", "text": "Example B" }
      ],
      "premises": [
        {
          "id": "P-A",
          "kind": "text",
          "text": "Premise derived from Example A",
          "exampleIds": ["EX-A"]
        },
        {
          "id": "P-B",
          "kind": "text",
          "text": "Premise derived from Example B",
          "exampleIds": ["EX-B"]
        }
      ],
      "reasoning": "The examples jointly motivate the original interpretation.",
      "conclusion": "Original conclusion",
      "reviewState": "accepted"
    },
    {
      "id": "ARG-DEMO-A2",
      "title": "Refined explanation",
      "premises": [
        {
          "id": "P-REUSE-A",
          "kind": "argument-premise",
          "argumentId": "ARG-DEMO-A1",
          "premiseId": "P-A"
        },
        {
          "id": "P-REUSE-B",
          "kind": "argument-premise",
          "argumentId": "ARG-DEMO-A1",
          "premiseId": "P-B"
        },
        { "id": "P-NEW", "kind": "text", "text": "Additional premise" }
      ],
      "reasoning": "The original premises survive, but their relationship changes.",
      "conclusion": "Refined conclusion",
      "boundary": "A specified irrelevant variation leaves it unchanged.",
      "relations": [
        {
          "id": "REL-A2-A1",
          "kind": "attack",
          "targetArgumentId": "ARG-DEMO-A1",
          "targetPart": { "kind": "reasoning" }
        }
      ],
      "supersedesArgumentId": "ARG-DEMO-A1",
      "reviewState": "accepted"
    }
  ],
  "memberships": [
    { "topicId": "TOP-DEMO", "kind": "argument", "recordId": "ARG-DEMO-A1" },
    { "topicId": "TOP-DEMO", "kind": "argument", "recordId": "ARG-DEMO-A2" }
  ],
  "currentPromotions": [{ "topicId": "TOP-DEMO", "argumentId": "ARG-DEMO-A2" }]
}
```
