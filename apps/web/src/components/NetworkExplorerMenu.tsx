import type { ReactNode } from 'react';
import { GraphContextMenu } from '@icarus-graph-explorer/renderer-reactflow';

import type {
  NetworkExplorerAction,
  NetworkExplorerMenuAction,
} from '../network-explorer-context';

/** Network adapter over the shared graph context-menu portal. */
export function NetworkExplorerMenu({
  actions,
  name,
  x,
  y,
  onCancel,
  onAction,
  editor,
}: {
  readonly actions: readonly NetworkExplorerMenuAction[];
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly onCancel: (restoreFocus: boolean) => void;
  readonly onAction: (action: NetworkExplorerAction) => void;
  readonly editor?: { readonly label: string; readonly content: ReactNode };
}) {
  return GraphContextMenu<NetworkExplorerAction>({
    actions,
    name,
    onAction,
    onCancel,
    x,
    y,
    ...(editor === undefined ? {} : { editor }),
  });
}
