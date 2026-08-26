# Workspace fixtures

Parser and adapter work uses this convention:

```text
workspaces/<case>/
  README.md          Why the case exists and which source rules it exercises.
  input/
    A.md             Synthetic workspace-relative source files.
    B.md
  expected/          Optional parser IR or later-stage contract output.
```

Keep each case deterministic, platform-independent, and understandable by
inspection. Preserve the input tree and use forward-slash relative paths in
expected data. An expected file must name and conform to the stage-specific
contract it represents; parser structure must not masquerade as a canonical
snapshot. Do not commit absolute machine paths, real vault content, fake output,
or empty case directories.

`section-extents/` is the first KG2 CommonMark case. Its package test asserts
parser intermediate structure directly because a separate golden JSON file
would duplicate short, behavior-focused assertions.

When a private workspace reveals a defect, reduce it to the smallest synthetic
case and explain the generic behavior in that case's README.
