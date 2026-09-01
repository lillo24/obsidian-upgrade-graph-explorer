import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from 'react';

import type {
  VisualGroupNodePresentation,
  VisualGroupPresentationMap,
} from '@icarus-graph-explorer/visual-groups';

const VisualGroupPresentationContext = createContext<
  VisualGroupPresentationMap | undefined
>(undefined);

export const REACT_FLOW_VISUAL_GROUP_STYLE_UPDATE_CONTRACT = {
  projection: 0,
  mapping: 0,
  layout: 0,
  geometryChanges: 0,
  styleRenders: 1,
} as const;

export function VisualGroupPresentationProvider({
  children,
  styles,
}: {
  readonly children: ReactNode;
  readonly styles?: VisualGroupPresentationMap | undefined;
}) {
  return (
    <VisualGroupPresentationContext.Provider value={styles}>
      {children}
    </VisualGroupPresentationContext.Provider>
  );
}

export function useVisualGroupPresentation(
  entityId: string,
): VisualGroupNodePresentation | undefined {
  return useContext(VisualGroupPresentationContext)?.get(entityId);
}

export function visualGroupAccentStyle(
  presentation: VisualGroupNodePresentation | undefined,
): CSSProperties | undefined {
  return presentation === undefined
    ? undefined
    : ({
        '--visual-group-accent': presentation.accent,
      } as CSSProperties);
}
