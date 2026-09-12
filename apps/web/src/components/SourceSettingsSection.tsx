import { memo, type ChangeEventHandler } from 'react';

const NUMBER_FORMAT = new Intl.NumberFormat();

interface SourceSettingsSectionProps {
  readonly currentSourceName: string;
  readonly currentStatus: string;
  readonly desktopAvailable: boolean;
  readonly entityCount: number;
  readonly live: boolean;
  readonly markdownFileCount: number;
  readonly onOpenVault: () => void;
  readonly onReportChange: ChangeEventHandler<HTMLInputElement>;
  readonly onRescanVault: () => void;
  readonly onResetLocalIdentity: () => void;
  readonly onUseSample: () => void;
  readonly opening: boolean;
  readonly recoveryLabel?: string;
  readonly reportIsSample: boolean;
  readonly rescanDisabled: boolean;
  readonly sourceDetail?: string;
  readonly sourceWarning?: string;
}

export const SourceSettingsSection = memo(function SourceSettingsSection({
  currentSourceName,
  currentStatus,
  desktopAvailable,
  entityCount,
  live,
  markdownFileCount,
  onOpenVault,
  onReportChange,
  onRescanVault,
  onResetLocalIdentity,
  onUseSample,
  opening,
  recoveryLabel,
  reportIsSample,
  rescanDisabled,
  sourceDetail,
  sourceWarning,
}: SourceSettingsSectionProps) {
  return (
    <section
      aria-labelledby="source-settings-heading"
      className="graph-settings__section source-settings"
    >
      <h3 id="source-settings-heading">Source</h3>
      <div className="source-settings__current">
        <span>Current Source</span>
        <strong title={currentSourceName} translate="no">
          {currentSourceName}
        </strong>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{currentStatus}</dd>
          </div>
        </dl>
        <p>
          {NUMBER_FORMAT.format(markdownFileCount)} Markdown ·{' '}
          {NUMBER_FORMAT.format(entityCount)} entities
        </p>
        {sourceDetail === undefined ? null : (
          <p className="source-settings__detail">{sourceDetail}</p>
        )}
        {sourceWarning === undefined ? null : (
          <p className="source-settings__warning">{sourceWarning}</p>
        )}
      </div>

      <div className="source-settings__actions">
        {desktopAvailable ? (
          <button disabled={opening} onClick={onOpenVault} type="button">
            {opening
              ? 'Opening Vault…'
              : live
                ? 'Open Another Vault'
                : 'Open Vault'}
          </button>
        ) : null}
        <label
          aria-disabled={opening}
          className="source-settings__report-action"
          htmlFor="report-file"
        >
          Open Report
        </label>
        <input
          accept="application/json,.json"
          aria-describedby="source-privacy-note"
          className="report-file-input"
          disabled={opening}
          id="report-file"
          name="diagnostic-report"
          onChange={onReportChange}
          type="file"
        />
        {reportIsSample ? null : (
          <button disabled={opening} onClick={onUseSample} type="button">
            Use Synthetic Sample
          </button>
        )}
        {live ? (
          <button
            disabled={rescanDisabled}
            onClick={onRescanVault}
            type="button"
          >
            Rescan Vault
          </button>
        ) : null}
      </div>
      <p className="source-settings__privacy" id="source-privacy-note">
        Sources are read locally. Reports stay in this app and are not uploaded.
      </p>

      {recoveryLabel === undefined ? null : (
        <section
          aria-labelledby="source-recovery-heading"
          className="source-settings__recovery"
        >
          <h4 id="source-recovery-heading">Recovery</h4>
          <p>
            Local identity recovery changes graph continuity. It does not reset
            the current graph view or Named Saved Views by itself.
          </p>
          <button
            disabled={opening}
            onClick={onResetLocalIdentity}
            type="button"
          >
            {recoveryLabel}
          </button>
        </section>
      )}
    </section>
  );
});
