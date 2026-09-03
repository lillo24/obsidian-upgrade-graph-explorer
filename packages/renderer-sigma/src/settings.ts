import type {
  GlobalLayoutCustomSettings,
  GlobalLayoutSettings,
  GlobalSpacingPreset,
  ResolvedGlobalLayoutSettings,
} from './types';

export type {
  GlobalLayoutCustomSettings,
  GlobalLayoutSettings,
  GlobalSpacingPreset,
} from './types';

export const GLOBAL_LAYOUT_CUSTOM_RANGES = {
  linkForce: { min: 0.25, max: 2 },
  folderCohesion: { min: 0, max: 0.18 },
  withinFolderSpacing: { min: 0.5, max: 3 },
  betweenFolderSpacing: { min: 1, max: 8 },
  nodeSize: { min: 2, max: 9 },
  referenceDegreeSizeInfluence: { min: 0, max: 100 },
  linkThickness: { min: 0.2, max: 2.5 },
  labelThreshold: { min: 2, max: 16 },
} as const satisfies Record<
  keyof GlobalLayoutCustomSettings,
  { readonly min: number; readonly max: number }
>;

/** Product percentage that reproduces the pre-VISUAL1A degree-size curve. */
export const DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE = 50;

const PRESETS = {
  compact: {
    linkForce: 1.15,
    folderCohesion: 0.09,
    withinFolderSpacing: 0.8,
    betweenFolderSpacing: 2.2,
    nodeSize: 4,
    referenceDegreeSizeInfluence: DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
    linkThickness: 0.75,
    labelThreshold: 8,
  },
  normal: {
    linkForce: 1,
    folderCohesion: 0.08,
    withinFolderSpacing: 1.15,
    betweenFolderSpacing: 3.2,
    nodeSize: 4.5,
    referenceDegreeSizeInfluence: DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
    linkThickness: 0.7,
    labelThreshold: 7,
  },
  spacious: {
    linkForce: 0.85,
    folderCohesion: 0.07,
    withinFolderSpacing: 1.65,
    betweenFolderSpacing: 4.6,
    nodeSize: 5,
    referenceDegreeSizeInfluence: DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
    linkThickness: 0.65,
    labelThreshold: 6,
  },
} as const satisfies Record<GlobalSpacingPreset, GlobalLayoutCustomSettings>;

export const DEFAULT_GLOBAL_LAYOUT_SETTINGS: GlobalLayoutSettings = {
  folderClustering: true,
  spacingPreset: 'normal',
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSpacingPreset(value: unknown): value is GlobalSpacingPreset {
  return value === 'compact' || value === 'normal' || value === 'spacious';
}

function boundedNumber(
  value: unknown,
  key: keyof GlobalLayoutCustomSettings,
): number {
  const range = GLOBAL_LAYOUT_CUSTOM_RANGES[key];
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < range.min ||
    value > range.max
  ) {
    throw new Error(
      `Global layout setting ${key} must be a finite number from ${range.min} to ${range.max}.`,
    );
  }
  return value;
}

export function validateGlobalLayoutSettings(
  value: unknown,
): GlobalLayoutSettings {
  if (!isPlainRecord(value)) {
    throw new Error('Global layout settings must be a plain object.');
  }
  const allowed = new Set(['folderClustering', 'spacingPreset', 'custom']);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected !== undefined) {
    throw new Error(
      `Global layout settings contain unexpected field ${unexpected}.`,
    );
  }
  if (typeof value.folderClustering !== 'boolean') {
    throw new Error('Global layout setting folderClustering must be boolean.');
  }
  if (!isSpacingPreset(value.spacingPreset)) {
    throw new Error(
      'Global layout setting spacingPreset must be compact, normal, or spacious.',
    );
  }
  if (!Object.hasOwn(value, 'custom')) {
    return {
      folderClustering: value.folderClustering,
      spacingPreset: value.spacingPreset,
    };
  }
  if (!isPlainRecord(value.custom)) {
    throw new Error('Global layout custom settings must be a plain object.');
  }
  const customKeys = Object.keys(
    GLOBAL_LAYOUT_CUSTOM_RANGES,
  ) as (keyof GlobalLayoutCustomSettings)[];
  const customAllowed = new Set(customKeys);
  const unexpectedCustom = Object.keys(value.custom).find(
    (key) => !customAllowed.has(key as keyof GlobalLayoutCustomSettings),
  );
  if (unexpectedCustom !== undefined) {
    throw new Error(
      `Global layout custom settings contain unexpected field ${unexpectedCustom}.`,
    );
  }
  for (const key of customKeys) {
    if (key === 'referenceDegreeSizeInfluence') continue;
    if (!Object.hasOwn(value.custom, key)) {
      throw new Error(`Global layout custom setting ${key} is required.`);
    }
  }
  const custom: GlobalLayoutCustomSettings = {
    linkForce: boundedNumber(value.custom.linkForce, 'linkForce'),
    folderCohesion: boundedNumber(
      value.custom.folderCohesion,
      'folderCohesion',
    ),
    withinFolderSpacing: boundedNumber(
      value.custom.withinFolderSpacing,
      'withinFolderSpacing',
    ),
    betweenFolderSpacing: boundedNumber(
      value.custom.betweenFolderSpacing,
      'betweenFolderSpacing',
    ),
    nodeSize: boundedNumber(value.custom.nodeSize, 'nodeSize'),
    referenceDegreeSizeInfluence: Object.hasOwn(
      value.custom,
      'referenceDegreeSizeInfluence',
    )
      ? boundedNumber(
          value.custom.referenceDegreeSizeInfluence,
          'referenceDegreeSizeInfluence',
        )
      : DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
    linkThickness: boundedNumber(value.custom.linkThickness, 'linkThickness'),
    labelThreshold: boundedNumber(
      value.custom.labelThreshold,
      'labelThreshold',
    ),
  };
  return {
    folderClustering: value.folderClustering,
    spacingPreset: value.spacingPreset,
    custom,
  };
}

export function resolveGlobalLayoutSettings(
  settings: GlobalLayoutSettings,
): ResolvedGlobalLayoutSettings {
  const validated = validateGlobalLayoutSettings(settings);
  return {
    folderClustering: validated.folderClustering,
    spacingPreset: validated.spacingPreset,
    ...(validated.custom ?? PRESETS[validated.spacingPreset]),
  };
}

export function customGlobalLayoutSettings(
  preset: GlobalSpacingPreset,
): GlobalLayoutCustomSettings {
  return { ...PRESETS[preset] };
}

const FOLDER_COHESION_MAX = GLOBAL_LAYOUT_CUSTOM_RANGES.folderCohesion.max;

function customFromResolved(
  settings: ResolvedGlobalLayoutSettings,
): GlobalLayoutCustomSettings {
  return {
    linkForce: settings.linkForce,
    folderCohesion: settings.folderCohesion,
    withinFolderSpacing: settings.withinFolderSpacing,
    betweenFolderSpacing: settings.betweenFolderSpacing,
    nodeSize: settings.nodeSize,
    referenceDegreeSizeInfluence: settings.referenceDegreeSizeInfluence,
    linkThickness: settings.linkThickness,
    labelThreshold: settings.labelThreshold,
  };
}

/** Product-facing 0–100 scale backed only by persisted folderCohesion. */
export function folderClusteringStrength(
  settings: GlobalLayoutSettings,
): number {
  return Math.round(
    (resolveGlobalLayoutSettings(settings).folderCohesion /
      FOLDER_COHESION_MAX) *
      100,
  );
}

export function withFolderClusteringStrength(
  settings: GlobalLayoutSettings,
  percent: number,
): GlobalLayoutSettings {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(
      'Folder clustering strength must be a finite percentage from 0 to 100.',
    );
  }
  const resolved = resolveGlobalLayoutSettings(settings);
  const folderCohesion = Number(
    ((FOLDER_COHESION_MAX * Math.round(percent)) / 100).toFixed(6),
  );
  return {
    folderClustering: resolved.folderClustering,
    spacingPreset: resolved.spacingPreset,
    custom: { ...customFromResolved(resolved), folderCohesion },
  };
}

/** Applies a spatial baseline while keeping folder strength and visual choices independent. */
export function withGlobalSpacingPreset(
  settings: GlobalLayoutSettings,
  spacingPreset: GlobalSpacingPreset,
): GlobalLayoutSettings {
  const resolved = resolveGlobalLayoutSettings(settings);
  return {
    folderClustering: settings.folderClustering,
    spacingPreset,
    custom: {
      ...customGlobalLayoutSettings(spacingPreset),
      folderCohesion: resolved.folderCohesion,
      nodeSize: resolved.nodeSize,
      referenceDegreeSizeInfluence: resolved.referenceDegreeSizeInfluence,
      linkThickness: resolved.linkThickness,
      labelThreshold: resolved.labelThreshold,
    },
  };
}
