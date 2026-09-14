# Tauri review history storage

This outer adapter implements the headless review-history store beneath the
app-local `review-workspace-v1` directory. It never reads or writes a selected
vault or repository checkout.

Each bounded record is stored separately and the summary index contains no
source or model output. Writes are serialized in-process, acquire a native
create-new lease, verify the expected content fingerprint, and replace unique
temporary siblings. A lease older than 2 minutes can be recovered because
record/index replacement is bounded; stale lease bytes remain app-local.

Malformed record IDs are rejected before path construction. Corrupt/future
records preserve their original UTF-8 bytes through the store load result. If
the summary index is unavailable, bounded record recovery isolates bad items so
one corrupt file does not hide valid neighboring records.

Finite limits are inherited from `review-workspace`: 5 MiB per record and 500
items. Nothing is silently evicted.
