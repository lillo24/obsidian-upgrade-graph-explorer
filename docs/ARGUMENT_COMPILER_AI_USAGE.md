# Icarus Argument Compiler AI cross-check protocol

Protocol version: `argument-compiler-ai-usage-v3`

Use this protocol when substantive candidate ideas already exist and the
Compiler cross-check is beginning. The Compiler is not the generator of the
initial critique: reason independently first, and do not reshape a candidate
merely because the Argument Library exists. The first pass does not need a
formal Premises / Reasoning / Conclusion schema. Use concrete examples when
they arise naturally; do not force them.

The Compiler Mailbox is the proposal-submission layer of this system. When
`compiler_submit_proposal` is available, that tool is the action used to send a
candidate to the Mailbox. The Mailbox is not an Argument Library record and
should not be searched for with `compiler_search_index`.

## 1. Build focused lexical searches

For each substantive candidate, identify internally what will help retrieval:

- the claim or model it attacks, supports, revises, or distinguishes;
- distinctive Icarus concepts and terms;
- a concrete example, when the candidate has one;
- the underlying relationship or reasoning in a short phrase.

Call `compiler_search_index` with short, information-rich queries. Search is
deterministic lexical/descriptive retrieval, not semantic embeddings, so use
multiple focused lexical formulations when terminology may differ. Do not
paste the whole critique as one query, do not guess record IDs, and do not use
a fixed number of searches: use enough variation to test plausible matches
without wasting calls.

For example, a candidate about Yes/No, Logical Value, Feeling Value, and
Symbolic Matching might use these different angles:

```text
Yes No Logical Value Feeling Value Symbolic Matching
same symbolic output different underlying processes
Feeling Value state matching Logical Value
```

Add example-specific terms when a concrete example may have appeared before.
A search hit is only a discovery candidate, not proof of equivalence. An empty
search result is valid.

## 2. Read the relevant bundle before deciding

Use this sequence:

```text
search result -> plausible prior record -> compiler_read_bundle -> comparison
```

Never decide that a criticism was already answered from a title, summary,
matched field, or score. For a plausible match, read the bounded bundle needed
to understand its target or challenged claim, Examples, premises and
dependencies, reasoning, conclusion, Boundary / Invariance, relevant
attack/support/supersession relations, Counter-Arguments and recorded
responses, answering Axioms, Current or historical role, and
stale/review/archive/completeness warnings.

Do not recursively read every related record. Start with bounded context and
expand only when the comparison genuinely depends on omitted context.

## 3. Compare argumentative roles, not vocabulary

Ask internally:

- Is the target materially the same?
- Does the example play the same argumentative role?
- Is the premise or assumption materially the same?
- Is the inference or reasoning materially the same?
- Is the conclusion materially the same?
- Does the recorded response apply under the same scope and boundary?

Keep these distinctions explicit:

```text
same words      != same argument
same example    != same argument
same conclusion != same route to that conclusion
similar topic   != already answered
```

This is an internal comparison protocol, not a required format for the final
answer to the user.

## 4. Fight the stored reasoning

The Argument Library is accumulated Icarus reasoning, not authority and not
external empirical proof. Treat a relevant prior objection and response as
reasoning to challenge. Test whether the new candidate survives it:

- Does the recorded response actually defeat the candidate?
- Does the new example fall outside the recorded boundary?
- Does the candidate rely on a distinction the prior reasoning missed?
- Is the real disagreement with an answering Axiom or premise?
- Is this merely an old objection in new words?
- Is the prior record stale or incomplete enough that it cannot settle the
  issue?

Choose the resulting action:

1. **Prior response still applies:** do not present the candidate as a new
   criticism; drop it or revise it.
2. **Candidate materially escapes the response:** preserve it and explain the
   material difference.
3. **Candidate attacks the response, Axiom, or premise:** reformulate it at
   that actual target instead of repeating the original objection.
4. **Relation unclear or record incomplete, stale, or limit-bounded:** preserve
   uncertainty; do not suppress the candidate merely because a similar record
   exists.
5. **No relevant precedent:** preserve the candidate as new.

The Compiler gives you someone to argue with, not doctrine to repeat.

## 5. Respect retrieval limits

Treat `not-found`, missing records, omissions, `limit-exceeded`, stale
snapshots or revisions, archived or pending-review records, stale warnings,
and unavailable capabilities as meaningful results. A partial or stale result
does not settle the comparison. When useful, retry with a narrower lexical
query or a smaller or shallower bundle rather than guessing.

This MCP server preserves linked theory-source references but cannot read live
source text. Do not imply that linked source passages were checked. If a
future/current tool list exposes an authorized source-reading capability, use
it selectively only when meaning, scope, or a stored dependency cannot be
resolved from the bundle.

## 6. Present and submit survivors

Do not clutter the final answer with every retrieval step. Omit candidates
defeated by existing reasoning. Present surviving or genuinely new arguments
clearly, briefly explain a relevant prior relationship when it matters, and
preserve uncertainty when the library did not settle the issue.

For this Compiler, `compiler_submit_proposal` is the action that sends a
candidate to the human-reviewed Compiler Mailbox.

If a meaningful new or revised candidate survives the cross-check:

1. Present the surviving candidate to the user in chat.
2. Call `compiler_submit_proposal` to send it to the Compiler Mailbox.
3. Follow the tool's actual schema and include useful review provenance. Use a
   target only when the candidate genuinely targets that Argument or part.
   Choose the review intent that describes the candidate (`refine`, `extend`,
   or `add-boundary` when appropriate) instead of forcing `attack`.
4. Encode existing Axiom, Argument-conclusion, and Argument-premise dependencies
   as typed, revision-pinned premises. Keep repository/file/commit observations
   in `sourceObservations`; they are drafting provenance and do not become
   canonical premises implicitly.
5. Include the exact consulted record IDs/revisions, why prior reasoning did not
   settle the candidate, and any unresolved scope or boundary. Simple reasoning
   prose is sufficient; use ordered reasoning steps only when their premise or
   earlier-step references help human review.

Do not search the Argument Library for a record called "Mailbox". The Mailbox
is a proposal-submission workflow, not canonical Argument Library knowledge.

A successful `compiler_submit_proposal` call means only that a pending,
non-canonical proposal was stored for human review. It does not accept the
idea, make it Current, mutate canonical theory, or replace an existing
Argument.

If `compiler_submit_proposal` is not present in the current tool list, do not
invent or claim a submission. Present the survivor to the user and state that
the Mailbox submission action is unavailable.
