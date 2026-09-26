import type {
  ArgumentLibrary,
  ArgumentProposal,
} from '@icarus-graph-explorer/argument-workspace';

export function proposalTargetStaleness(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
): string | undefined {
  const target = proposal.target;
  if (target === undefined) return undefined;
  const argument = library.arguments.find(({ id }) => id === target.argumentId);
  if (argument === undefined)
    return 'The target Argument is no longer present.';
  if (argument.revision !== target.reliedOnRevision)
    return `The proposal targeted revision ${target.reliedOnRevision}; the Argument is now revision ${argument.revision}.`;
  if (target.part.kind === 'premise') {
    const premiseId = target.part.premiseId;
    if (!argument.premises.some(({ id }) => id === premiseId))
      return `The targeted premise ${premiseId} is no longer present.`;
  }
  if (target.part.kind === 'reasoning' && argument.reasoning === undefined)
    return 'The targeted reasoning section is no longer present.';
  return undefined;
}
