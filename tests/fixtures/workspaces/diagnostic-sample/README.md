# Diagnostic explorer sample fixture

This synthetic workspace combines the smallest useful KG5 report features:
nested sections, resolved/unresolved/ambiguous references, marker-backed blocks,
case-only compatibility clues, attachment inventory evidence, one invalid
workspace escape, one same-document link, and a forwarded duplicate-block
diagnostic. The generated report contains structure and spans, never source
text. Repeated links to `Target.md` deliberately demonstrate document-level
edge aggregation.

The `.png` files are small text placeholders because KG5 inventories only their
paths; the scanner deliberately never reads non-Markdown content.
