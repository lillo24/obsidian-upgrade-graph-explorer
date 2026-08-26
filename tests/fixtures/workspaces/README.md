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

KG3 adds three focused Obsidian cases:

- `obsidian-frontmatter/` separates leading YAML aliases from structure;
- `obsidian-links/` preserves unresolved wikilink, embed, and Markdown targets;
- `obsidian-blocks/` covers exact, invalid, duplicate, and shielded markers.

Their adapter test asserts stage-specific IR directly. No fixture claims that a
syntactic target resolves to another file or canonical entity.

KG4 adds six independent multi-file resolver cases:

- `resolution-basic/` covers file links, occurrences, and source ownership;
- `resolution-ambiguous-files/` covers duplicate basenames, qualified paths,
  complete-target narrowing, and alias non-resolution;
- `resolution-headings/` covers exact same/cross-file and hierarchical targets;
- `resolution-blocks/` covers marker-backed entities and block ambiguity;
- `resolution-paths/` covers relative paths, traversal, and percent decoding;
- `resolution-attachments/` records the Markdown-only inventory boundary.

The resolver package parses these sources only as test setup. Its production
entry accepts KG3 values and never reads files.

When a private workspace reveals a defect, reduce it to the smallest synthetic
case and explain the generic behavior in that case's README.
