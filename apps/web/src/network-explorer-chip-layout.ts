/** Fit a single row, reserving the disclosure only when not all chips fit. */
export function visibleHiddenChipCount(
  widths: readonly number[],
  availableWidth: number,
  disclosureWidth: number,
  gap: number,
): number {
  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, widths.length - 1) * gap;
  if (total <= availableWidth) return widths.length;
  const budget = availableWidth - disclosureWidth - gap;
  let used = 0;
  let count = 0;
  for (const width of widths) {
    const next = used + (count === 0 ? 0 : gap) + width;
    if (next > budget) break;
    used = next;
    count += 1;
  }
  return count;
}
