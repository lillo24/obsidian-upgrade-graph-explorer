import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import { visibleHiddenChipCount } from '../network-explorer-chip-layout';
import { hiddenFileLabels } from '../network-explorer-query-actions';

interface HiddenItem {
  readonly identity: string;
  readonly label: string;
}

const HiddenChipGroup = memo(function HiddenChipGroup({
  items,
  kind,
  onRestore,
}: {
  readonly items: readonly HiddenItem[];
  readonly kind: 'files' | 'folders';
  readonly onRestore: (identity: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const rowRef = useRef<HTMLDivElement>(null);
  const disclosureRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const disclosure = disclosureRef.current;
    if (row === null || disclosure === null) return;
    const chips = [
      ...row.querySelectorAll<HTMLButtonElement>('[data-hidden-chip]'),
    ];
    const measure = () => {
      setVisibleCount(
        visibleHiddenChipCount(
          chips.map((chip) => chip.getBoundingClientRect().width),
          row.clientWidth,
          disclosure.getBoundingClientRect().width,
          Number.parseFloat(getComputedStyle(row).columnGap) || 0,
        ),
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(disclosure);
    for (const chip of chips) observer.observe(chip);
    return () => observer.disconnect();
  }, [items]);

  const showDisclosure = expanded || visibleCount < items.length;
  return (
    <div
      aria-label={`Hidden ${kind}`}
      className="network-explorer__hidden-chips"
      ref={rowRef}
      role="group"
    >
      <strong>{kind === 'files' ? 'Files' : 'Folders'}</strong>
      {items.map(({ identity, label }, index) => {
        const overflow = !expanded && index >= visibleCount;
        return (
          <button
            aria-hidden={overflow || undefined}
            aria-label={`Show ${identity} again`}
            className={
              overflow ? 'network-explorer__chip--overflow' : undefined
            }
            data-hidden-chip
            key={identity}
            onClick={() => onRestore(identity)}
            tabIndex={overflow ? -1 : undefined}
            title={`Show ${identity} again`}
            type="button"
          >
            <span className="network-explorer__chip-label">{label}</span>
            <span aria-hidden="true">×</span>
          </button>
        );
      })}
      <button
        aria-expanded={expanded}
        aria-hidden={!showDisclosure || undefined}
        aria-label={
          expanded ? `Show fewer hidden ${kind}` : `Show all hidden ${kind}`
        }
        className={`network-explorer__chips-disclosure${showDisclosure ? '' : ' network-explorer__chip--overflow'}`}
        onClick={() => setExpanded((current) => !current)}
        ref={disclosureRef}
        tabIndex={showDisclosure ? undefined : -1}
        type="button"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </div>
  );
});

/** Recovery derives solely from top-level QUERY1 file/folder exclusion terms. */
export const NetworkExplorerHiddenItems = memo(
  function NetworkExplorerHiddenItems({
    folderKeys,
    paths,
    onRestoreFile,
    onRestoreFolder,
  }: {
    readonly folderKeys: readonly WorkspaceFolderKey[];
    readonly paths: readonly string[];
    readonly onRestoreFile: (path: string) => void;
    readonly onRestoreFolder: (folderKey: WorkspaceFolderKey) => void;
  }) {
    const files = useMemo(
      () =>
        hiddenFileLabels(paths).map(({ path, label }) => ({
          identity: path,
          label,
        })),
      [paths],
    );
    const folders = useMemo(
      () =>
        folderKeys.map((folderKey) => ({
          identity: folderKey,
          label: folderKey === '.' ? 'Root folder' : folderKey,
        })),
      [folderKeys],
    );
    return (
      <div
        aria-label="Hidden query exclusions"
        className="network-explorer__hidden"
      >
        {files.length === 0 ? null : (
          <HiddenChipGroup
            items={files}
            kind="files"
            onRestore={onRestoreFile}
          />
        )}
        {folders.length === 0 ? null : (
          <HiddenChipGroup
            items={folders}
            kind="folders"
            onRestore={onRestoreFolder}
          />
        )}
      </div>
    );
  },
);
