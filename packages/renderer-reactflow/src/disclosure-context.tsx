import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface EntityDisclosureControl {
  readonly disabled: boolean;
  readonly toggle: (entityId: string, currentlyOpen: boolean) => void;
}

const EntityDisclosureContext = createContext<EntityDisclosureControl>({
  disabled: false,
  toggle: () => undefined,
});

export function EntityDisclosureProvider({
  children,
  disabled = false,
  onToggleEntity,
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onToggleEntity: (entityId: string, currentlyOpen: boolean) => void;
}) {
  const value = useMemo(
    () => ({ disabled, toggle: onToggleEntity }),
    [disabled, onToggleEntity],
  );
  return (
    <EntityDisclosureContext value={value}>{children}</EntityDisclosureContext>
  );
}

export function useEntityDisclosure(): EntityDisclosureControl {
  return useContext(EntityDisclosureContext);
}
