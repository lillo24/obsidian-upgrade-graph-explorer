# ADR 0003: Local-first, read-only initial trust boundary

**Status:** Accepted

## Context

Markdown workspaces may contain private material. The initial explorer does not require collaboration, accounts, remote compute, or editing source files.

## Decision

Require no backend, account, cloud upload, remote workspace processing, analytics, or Markdown write-back. Store only application-owned caches and view state locally when persistence is implemented.

## Consequences

The application can earn trust with a small data boundary. Cloud features, telemetry, collaboration, and source editing require later explicit decisions and consent. Repository fixtures must be synthetic; private Icarus content is never copied into tests.
