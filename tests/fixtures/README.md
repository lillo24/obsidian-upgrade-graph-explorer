# Test fixtures

Fixtures are repository-owned, synthetic examples shared across package tests.

## Map

```text
tests/fixtures/
  model/        Valid JSON examples of the canonical snapshot contract.
  workspaces/   CommonMark and Obsidian parser inputs; later resolver cases.
```

Fixtures must be small, deterministic, platform-independent, understandable by
inspection, and safe to publish. When a private workspace exposes a defect,
reduce it to the smallest synthetic regression case; never copy private Icarus
vault content, absolute local paths, or sensitive logs into this repository.

Read the README in each fixture family before adding a case. Unit-test builders
remain preferable for one-off invalid permutations that do not help later
packages as reusable examples.
