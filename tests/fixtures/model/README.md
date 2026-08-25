# Canonical model fixtures

These JSON files are small, validated examples of the versioned canonical
snapshot contract. They contain synthetic content only and may be loaded as
untrusted JSON before being passed to `validateKnowledgeSnapshot`.

`representative.snapshot.json` covers two documents, nested and duplicate
section titles, an addressable block, document-preamble provenance, both
reference kinds, and every resolution status. Focused invalid cases stay in
unit-test builders so committed JSON does not become a catalogue of nearly
identical broken snapshots.

When the schema version changes, add or migrate fixtures deliberately. A file
named as a canonical snapshot must always validate against the version it
declares.
