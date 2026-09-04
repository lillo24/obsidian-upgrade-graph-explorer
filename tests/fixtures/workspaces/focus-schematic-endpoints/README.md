# Focus Schematic endpoint fixture

This synthetic workspace exercises document, Heading, and Block reference
targets through the real Markdown/Obsidian resolution pipeline. `Root.md` owns
one preamble reference and Heading-owned references. The current canonical
resolver assigns authored references to a document or deepest containing
Heading; Markdown Blocks are addressable targets but do not own outgoing
references, so the fixture records that precondition instead of inventing a
Block source.

`File Target.md`, `Heading Target.md`, and `Block Target.md` provide the three
target precisions. The files contain no private or user-derived content.
