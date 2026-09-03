import type {
  NetworkExplorerModel,
  NetworkExplorerNode,
  NetworkExplorerRow,
} from './network-explorer-model';

export type NetworkExplorerAction = 'focus' | 'inspect' | 'hide';
export interface NetworkExplorerMenuAction {
  readonly id: NetworkExplorerAction;
  readonly label: string;
  readonly disabledReason?: string;
}

export function networkExplorerContextTarget(
  row: NetworkExplorerRow,
  model: NetworkExplorerModel,
): NetworkExplorerNode | undefined {
  return row.kind === 'node' ? model.nodeById.get(row.node.id) : undefined;
}

export function networkExplorerMenuActions(
  node: NetworkExplorerNode,
  focusedSourcePath: string | undefined,
  hiddenPaths: ReadonlySet<string>,
): readonly NetworkExplorerMenuAction[] {
  const hideReason =
    node.sourcePath === undefined
      ? 'Only source files can be hidden.'
      : node.sourcePath === focusedSourcePath
        ? 'Change Focus before hiding the focused file.'
        : hiddenPaths.has(node.sourcePath)
          ? 'This file is already hidden by the applied query.'
          : undefined;
  return [
    {
      id: 'focus',
      label: 'Focus',
      ...(node.entityId === undefined
        ? { disabledReason: 'Only source entities can be focused.' }
        : {}),
    },
    { id: 'inspect', label: 'Inspect' },
    {
      id: 'hide',
      label: 'Hide file',
      ...(hideReason === undefined ? {} : { disabledReason: hideReason }),
    },
  ];
}

export function networkExplorerMenuIndex(
  actions: readonly NetworkExplorerMenuAction[],
  current: number,
  key: string,
): number {
  const enabled = actions.flatMap((action, index) =>
    action.disabledReason === undefined ? [index] : [],
  );
  if (enabled.length === 0) return -1;
  if (key === 'Home') return enabled[0]!;
  if (key === 'End') return enabled[enabled.length - 1]!;
  const offset = enabled.indexOf(current);
  if (key === 'ArrowDown') return enabled[(offset + 1) % enabled.length]!;
  if (key === 'ArrowUp')
    return enabled[(offset - 1 + enabled.length) % enabled.length]!;
  return current;
}
