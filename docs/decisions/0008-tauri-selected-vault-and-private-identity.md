# ADR 0008: Use selected-vault Tauri scope and private app-local identity

**Status:** Accepted

## Context

KG10 can initialize the complete in-memory workspace from source strings and a
KG9A catalog, but the browser application cannot securely acquire an arbitrary
local Markdown folder. Tauri v2 can host the existing frontend and grant
filesystem scope after a user selects a directory. That dialog-added scope is
valid only for the current process and must not be replaced with blanket home
or drive access merely to make reopening automatic.

Stable identity also needs a durable association between an absolute platform
root and an opaque workspace ID. Absolute roots are private platform metadata;
they are not canonical knowledge data and must not enter reports, KG9A
catalogs, or KG9B saved view state.

## Decision

Tauri v2 wraps the existing Vite/React frontend. A narrow Tauri source-provider
adapter owns native directory selection, one-shot recursive acquisition, and
private application-data persistence. The user-selected root receives dynamic
read scope for that session; static capabilities grant app-data access but no
blanket home or drive read scope. Restarting therefore requires explicit folder
reselection, and automatic broad reopen is deferred.

A versioned app-local registry maps the exact normalized absolute root to an
opaque workspace ID. The matching KG9A catalog remains app-local and outside
the Markdown vault. After acquisition, the web application initializes KG10,
builds its existing diagnostic report directly from `engine.parsedDocuments()`,
and retains the engine for the next desktop stage. A report claims stable
identity only after the next catalog and any registry association are safely
persisted; otherwise the session is marked transient with a warning.

KG11A performs one-shot acquisition only. Filesystem watching, event
coalescing, live KG10 batches, and out-of-sync rescan belong to KG11B.

## Consequences

Browser report/sample mode remains independent of Tauri, and source/platform
APIs do not enter generic domain packages. Users must reselect a vault after a
desktop restart. An exact root match restores the prior workspace/catalog and
KG9B view; a moved or renamed root is a new association because KG11A does not
fingerprint or fuzzy-match vaults. Private state needs explicit corruption
recovery and failure-safe replacement, but no database or store plugin.
