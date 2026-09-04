import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

interface DocumentDirectHoverContextValue {
  readonly setDocumentDirectHover: (
    nodeId: ProjectionNodeId,
    active: boolean,
  ) => void;
}

const DocumentDirectHoverContext =
  createContext<DocumentDirectHoverContextValue | null>(null);
const NO_DOCUMENT_DIRECT_HOVER: DocumentDirectHoverContextValue = {
  setDocumentDirectHover: () => undefined,
};

export function DocumentDirectHoverProvider({
  children,
  setDocumentDirectHover,
}: DocumentDirectHoverContextValue & { readonly children: ReactNode }) {
  const value = useMemo(
    () => ({ setDocumentDirectHover }),
    [setDocumentDirectHover],
  );
  return (
    <DocumentDirectHoverContext.Provider value={value}>
      {children}
    </DocumentDirectHoverContext.Provider>
  );
}

export function useDocumentDirectHover(): DocumentDirectHoverContextValue {
  return useContext(DocumentDirectHoverContext) ?? NO_DOCUMENT_DIRECT_HOVER;
}
