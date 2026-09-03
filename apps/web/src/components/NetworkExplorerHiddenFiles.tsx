import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { visibleHiddenChipCount } from '../network-explorer-chip-layout';
import { hiddenFileLabels } from '../network-explorer-query-actions';

/** Presentation-only disclosure; restoring a chip still removes a QUERY1 exclusion. */
export const NetworkExplorerHiddenFiles = memo(
  function NetworkExplorerHiddenFiles({
    paths,
    onRestoreFile,
  }: {
    readonly paths: readonly string[];
    readonly onRestoreFile: (path: string) => void;
  }) {
    const files = useMemo(() => hiddenFileLabels(paths), [paths]);
    const [expanded, setExpanded] = useState(false);
    const [visibleCount, setVisibleCount] = useState(1);
    const rowRef = useRef<HTMLDivElement>(null);
    const disclosureRef = useRef<HTMLButtonElement>(null);

    useLayoutEffect(() => {
      const row = rowRef.current;
      const disclosure = disclosureRef.current;
      if (row === null || disclosure === null) return;
      const chips = [
        ...row.querySelectorAll<HTMLButtonElement>('[data-hidden-file-chip]'),
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
    }, [files]);

    const showDisclosure = expanded || visibleCount < files.length;
    return (
      <div className="network-explorer__hidden">
        <div
          aria-label="Hidden files"
          className="network-explorer__hidden-chips"
          ref={rowRef}
          role="group"
        >
          {files.map(({ path, label }, index) => {
            const overflow = !expanded && index >= visibleCount;
            return (
              <button
                aria-hidden={overflow || undefined}
                aria-label={`Show ${path} again`}
                className={
                  overflow ? 'network-explorer__chip--overflow' : undefined
                }
                data-hidden-file-chip
                key={path}
                onClick={() => onRestoreFile(path)}
                tabIndex={overflow ? -1 : undefined}
                title={`Show ${path} again`}
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
              expanded ? 'Show fewer hidden files' : 'Show all hidden files'
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
      </div>
    );
  },
);
