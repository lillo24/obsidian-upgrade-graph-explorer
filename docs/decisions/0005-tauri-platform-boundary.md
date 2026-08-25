# ADR 0005: Defer Tauri behind a source-provider boundary

**Status:** Accepted

## Context

A desktop shell is likely useful for local folder selection and filesystem watching, but KG0 has no vault workflow and does not need Rust or native APIs.

## Decision

Defer Tauri to KG11. When introduced, expose filesystem behavior through narrow source-provider contracts. Prohibit Tauri commands, event types, paths, handles, and dependencies in generic core packages.

## Consequences

The SPA foundation stays small and browser-compatible. Desktop capabilities can arrive when their requirements are understood. Platform integration will depend on core contracts rather than redefining them.
