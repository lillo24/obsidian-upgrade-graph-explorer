import { memo, useEffect } from 'react';

export const SAVED_VIEW_TRANSITION_DURATION_MS = 390;

export interface SavedViewVisualTransition {
  readonly name: string;
  readonly token: number;
  readonly origin: 'apply' | 'startup-match';
}

const SHARDS = Array.from({ length: 8 }, (_, index) => index);

/** Decorative, compositor-only acknowledgement of a truthful Saved View load. */
export const SavedViewTransitionOverlay = memo(
  function SavedViewTransitionOverlay({
    onComplete,
    transition,
  }: {
    readonly onComplete: (token: number) => void;
    readonly transition: SavedViewVisualTransition | undefined;
  }) {
    useEffect(() => {
      if (transition === undefined) return;
      const token = transition.token;
      const timeout = window.setTimeout(
        () => onComplete(token),
        SAVED_VIEW_TRANSITION_DURATION_MS,
      );
      return () => window.clearTimeout(timeout);
    }, [onComplete, transition]);

    if (transition === undefined) return null;

    return (
      <div
        aria-hidden="true"
        className="saved-view-transition"
        data-saved-view-transition-origin={transition.origin}
        data-saved-view-transition-token={transition.token}
        key={transition.token}
      >
        <div className="saved-view-transition__shards">
          {SHARDS.map((shard) => (
            <span className="saved-view-transition__shard" key={shard} />
          ))}
        </div>
        <div className="saved-view-transition__copy">
          <strong className="saved-view-transition__title">
            {transition.name}
          </strong>
          <span className="saved-view-transition__subtitle">View loaded</span>
        </div>
      </div>
    );
  },
);
