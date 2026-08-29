import { memo } from 'react';

export const DeveloperSettingsSection = memo(function DeveloperSettingsSection({
  onOpenDiagnosticEvidence,
}: {
  readonly onOpenDiagnosticEvidence: () => void;
}) {
  return (
    <section
      aria-labelledby="developer-settings-heading"
      className="graph-settings__section developer-settings"
    >
      <h3 id="developer-settings-heading">Developer</h3>
      <p>
        Inspect source diagnostics without changing the graph layout or current
        view.
      </p>
      <button
        className="developer-settings__launcher"
        onClick={onOpenDiagnosticEvidence}
        type="button"
      >
        Open Diagnostic Evidence
      </button>
    </section>
  );
});
