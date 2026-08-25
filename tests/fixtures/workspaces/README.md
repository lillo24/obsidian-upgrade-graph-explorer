# Future workspace fixtures

KG2 and later parser/adapter work may add small cases using this convention:

```text
workspaces/<case>/
  README.md          Why the case exists and which source rules it exercises.
  input/
    A.md             Synthetic workspace-relative source files.
    B.md
  expected/          Optional, once a parser output contract actually exists.
```

Keep each case deterministic, platform-independent, and understandable by
inspection. Preserve the input tree and use forward-slash relative paths in
expected canonical data. Do not commit absolute machine paths, real vault
content, fake parser output, or empty case directories.

When a private workspace reveals a defect, reduce it to the smallest synthetic
case and explain the generic behavior in that case's README.
