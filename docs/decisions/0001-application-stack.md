# ADR 0001: TypeScript, React, Vite, and pnpm workspace

**Status:** Accepted

## Context

The product begins as a graph-heavy, local-first client application. KG0 needs reproducible tooling and package boundaries without assuming server rendering, desktop APIs, deployment infrastructure, or a monorepo orchestrator.

## Decision

Use TypeScript with strict settings, React, and Vite for an initial SPA. Manage `apps/*` and `packages/*` with a pinned pnpm workspace. Do not use Flutter, Next.js, Nx, or Turborepo in the foundation.

## Consequences

The web shell can iterate quickly while domain code lives behind framework-independent package boundaries. Server rendering and Flutter portability are not goals. A future delivery technology must integrate through existing boundaries and provide evidence before this stack is replaced or expanded.
