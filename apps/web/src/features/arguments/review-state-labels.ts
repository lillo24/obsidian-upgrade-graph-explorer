import type { HumanReviewState } from '@icarus-graph-explorer/argument-workspace';

export const HUMAN_REVIEW_STATES: readonly HumanReviewState[] = [
  'draft',
  'pending-review',
  'accepted',
  'reopened',
  'rejected',
];

const HUMAN_REVIEW_STATE_LABELS: Readonly<Record<HumanReviewState, string>> = {
  draft: 'Draft',
  'pending-review': 'Pending review',
  accepted: 'Accepted',
  reopened: 'Reopened',
  rejected: 'Rejected',
};

export function humanReviewStateLabel(state: HumanReviewState): string {
  return HUMAN_REVIEW_STATE_LABELS[state];
}
