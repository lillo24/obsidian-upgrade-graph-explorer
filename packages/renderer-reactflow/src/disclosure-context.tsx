import { createContext, useContext, type ReactNode } from 'react';

const EntityDisclosureContext = createContext<
  (entityId: string, currentlyOpen: boolean) => void
>(() => undefined);

export function EntityDisclosureProvider({
  children,
  onToggleEntity,
}: {
  readonly children: ReactNode;
  readonly onToggleEntity: (entityId: string, currentlyOpen: boolean) => void;
}) {
  return (
    <EntityDisclosureContext value={onToggleEntity}>
      {children}
    </EntityDisclosureContext>
  );
}

export function useEntityDisclosure(): (
  entityId: string,
  currentlyOpen: boolean,
) => void {
  return useContext(EntityDisclosureContext);
}
