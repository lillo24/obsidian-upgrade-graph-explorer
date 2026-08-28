# Vault Discovery Policy

Status: **STABLE — KG11A shares these pure traversal rules between Node and Tauri tests.**

This source-neutral package owns only the lexical rules that keep local vault
discovery consistent: normalized excludes, hidden and `node_modules` skipping,
case-insensitive Markdown classification, deterministic comparison, and safe
workspace-path construction. It performs no I/O and knows nothing about Node,
Tauri, identity, parsing, reports, or UI.

```text
src/
  index.ts       Pure shared discovery policy.
  index.test.ts  Boundary and normalization coverage.
```
