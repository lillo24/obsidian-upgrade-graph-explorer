import {
  assertSafeMetadata,
  clonePlainData,
  deepFreeze,
  deterministicFingerprint,
  plainDataByteLength,
  utf8Bytes,
} from './plain-data';
import { resolveTemplates } from './templates';
import type {
  CompilerPlacementPolicy,
  FrozenReviewInput,
  ReviewMaterial,
  ReviewResourceLimits,
  ReviewTemplates,
  StartReviewInput,
} from './types';

export const DEFAULT_REVIEW_LIMITS: ReviewResourceLimits = {
  maxInputBytes: 1_048_576,
  maxPromptBytes: 2_097_152,
  maxOutputBytes: 262_144,
  maxExecutionMs: 120_000,
  maxToolCalls: 12,
  maxToolResultBytes: 262_144,
};

export const DEFAULT_COMPILER_POLICY: CompilerPlacementPolicy = {
  analysis: false,
  integrator: false,
  postCheck: false,
};

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty.`);
  }
}

function assertRelativePath(path: string): void {
  assertNonEmpty(path, 'Selected relative path');
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-zA-Z]:/.test(path) ||
    path.split(/[\\/]/).includes('..')
  ) {
    throw new Error(`Review path must be relative and contained: ${path}`);
  }
}

function validateMaterial(material: ReviewMaterial): void {
  assertNonEmpty(material.id, 'Material ID');
  assertRelativePath(material.relativePath);
  assertNonEmpty(material.content, `Material ${material.id} content`);
  assertNonEmpty(
    material.provenance.kind === 'supplied'
      ? material.provenance.label
      : material.provenance.commitId,
    'Provenance',
  );
}

function renderSharedMaterial(input: StartReviewInput): string {
  const source = input.source;
  const lines = [
    `Workspace identity: ${input.workspaceId}`,
    `Source mode: ${source.mode}`,
    `Completeness: ${source.completeness}`,
    `Selected paths: ${source.selectedPaths.join(', ')}`,
  ];
  if (source.mode === 'captured-git-history') {
    lines.push(
      `Git base: ${source.baseCommitId}`,
      `Git head: ${source.headCommitId}`,
      `Commit count: ${source.commitCount}`,
      `Commit IDs: ${source.commitIds.join(', ')}`,
    );
  }
  lines.push(
    `Missing material: ${source.missingMaterial.join('; ') || 'none declared'}`,
    `Omissions: ${source.omissions.join('; ') || 'none declared'}`,
  );
  for (const material of source.materials) {
    const provenance =
      material.provenance.kind === 'supplied'
        ? `supplied: ${material.provenance.label}`
        : `git commit ${material.provenance.commitId}; base ${material.provenance.baseCommitId}; head ${material.provenance.headCommitId}`;
    lines.push(
      '',
      `--- MATERIAL ${material.id} ---`,
      `Path: ${material.relativePath}`,
      `Kind: ${material.kind}`,
      `Provenance: ${provenance}`,
      '',
      material.content,
      `--- END MATERIAL ${material.id} ---`,
    );
  }
  return lines.join('\n');
}

function validateSource(input: StartReviewInput): void {
  assertNonEmpty(input.workspaceId, 'Workspace identity');
  if (
    input.workspaceId.startsWith('/') ||
    input.workspaceId.startsWith('\\') ||
    /^[a-zA-Z]:[\\/]/.test(input.workspaceId)
  ) {
    throw new Error(
      'Workspace identity must be opaque and must not be a machine-specific absolute root.',
    );
  }
  if (input.source.selectedPaths.length === 0) {
    throw new Error('At least one selected relative path is required.');
  }
  if (input.source.materials.length === 0) {
    throw new Error('Actual supplied source content or diffs are required.');
  }
  input.source.selectedPaths.forEach(assertRelativePath);
  input.source.materials.forEach(validateMaterial);
  if (
    new Set(input.source.selectedPaths).size !==
    input.source.selectedPaths.length
  ) {
    throw new Error('Selected relative paths must be unique.');
  }
  if (
    new Set(input.source.materials.map((material) => material.id)).size !==
    input.source.materials.length
  ) {
    throw new Error('Material IDs must be unique within a review input.');
  }
  const materialPaths = new Set(
    input.source.materials.map((material) => material.relativePath),
  );
  const selectedPaths = new Set(input.source.selectedPaths);
  for (const path of input.source.selectedPaths) {
    if (!materialPaths.has(path)) {
      throw new Error(
        `Selected path ${path} has no supplied material. Filenames alone are not review input.`,
      );
    }
  }
  for (const path of materialPaths) {
    if (!selectedPaths.has(path)) {
      throw new Error(
        `Material path ${path} is outside the explicit selected-path scope.`,
      );
    }
  }
  if (
    input.source.completeness === 'incomplete' &&
    input.source.acceptIncomplete !== true
  ) {
    throw new Error(
      'Incomplete source material requires acceptIncomplete: true as a deliberate caller decision.',
    );
  }
  if (
    input.source.completeness === 'incomplete' &&
    input.source.missingMaterial.length === 0 &&
    input.source.omissions.length === 0
  ) {
    throw new Error(
      'Incomplete source material must describe missing material or omissions.',
    );
  }
  if (input.source.mode === 'captured-git-history') {
    if (
      !Number.isInteger(input.source.commitCount) ||
      input.source.commitCount < 1 ||
      input.source.commitCount > 10
    ) {
      throw new Error(
        'Captured Git commitCount must be an integer from 1 through 10.',
      );
    }
    if (input.source.commitIds.length !== input.source.commitCount) {
      throw new Error('Captured Git commit IDs must match commitCount.');
    }
    assertNonEmpty(input.source.baseCommitId, 'Git base commit ID');
    assertNonEmpty(input.source.headCommitId, 'Git head commit ID');
    for (const material of input.source.materials) {
      if (material.provenance.kind !== 'git') {
        throw new Error('Captured Git material requires Git provenance.');
      }
      if (
        material.provenance.baseCommitId !== input.source.baseCommitId ||
        material.provenance.headCommitId !== input.source.headCommitId ||
        !input.source.commitIds.includes(material.provenance.commitId)
      ) {
        throw new Error(
          `Material ${material.id} provenance does not match the pinned Git range.`,
        );
      }
    }
  } else if (
    input.source.materials.some(
      (material) => material.provenance.kind !== 'supplied',
    )
  ) {
    throw new Error('Supplied material mode requires supplied provenance.');
  }
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

export function prepareReviewInput(input: StartReviewInput): {
  frozenInput: FrozenReviewInput;
  templates: ReviewTemplates;
  limits: ReviewResourceLimits;
  compilerPolicy: CompilerPlacementPolicy;
  models: StartReviewInput['models'];
} {
  validateSource(input);
  const copied = clonePlainData(input);
  const templates = resolveTemplates(copied.templates);
  for (const [name, template] of Object.entries(templates)) {
    assertNonEmpty(template.version, `${name} template version`);
    assertNonEmpty(template.text, `${name} template text`);
  }
  for (const [name, model] of Object.entries(copied.models)) {
    assertNonEmpty(model.provider, `${name} model provider`);
    assertNonEmpty(model.model, `${name} model name`);
    if (
      model.temperature !== undefined &&
      (!Number.isFinite(model.temperature) || model.temperature < 0)
    ) {
      throw new Error(
        `${name} model temperature must be a finite non-negative number.`,
      );
    }
    if (
      model.maxOutputTokens !== undefined &&
      (!Number.isSafeInteger(model.maxOutputTokens) ||
        model.maxOutputTokens <= 0)
    ) {
      throw new Error(
        `${name} maxOutputTokens must be a positive safe integer.`,
      );
    }
    if (model.metadata !== undefined) {
      assertSafeMetadata(model.metadata, `${name} model metadata`);
    }
  }
  const limits = { ...DEFAULT_REVIEW_LIMITS, ...copied.limits };
  for (const [name, value] of Object.entries(limits)) {
    validatePositiveInteger(value, name);
  }
  const compilerPolicy = {
    ...DEFAULT_COMPILER_POLICY,
    ...copied.compiler,
  };
  const sharedMaterial = renderSharedMaterial(copied);
  const fingerprintPayload = {
    workspaceId: copied.workspaceId,
    source: copied.source,
    additionalRequest: copied.additionalRequest,
    templates,
    models: copied.models,
    limits,
    compilerPolicy,
  };
  if (plainDataByteLength(fingerprintPayload) > limits.maxInputBytes) {
    throw new Error(
      `Frozen review input exceeds maxInputBytes (${limits.maxInputBytes}); no content was truncated.`,
    );
  }
  const frozenInput: FrozenReviewInput = {
    workspaceId: copied.workspaceId,
    source: copied.source,
    additionalRequest: copied.additionalRequest,
    sharedMaterial,
    fingerprint: deterministicFingerprint(fingerprintPayload),
  };
  if (utf8Bytes(sharedMaterial) > limits.maxInputBytes) {
    throw new Error(
      `Rendered shared material exceeds maxInputBytes (${limits.maxInputBytes}); no content was truncated.`,
    );
  }
  return deepFreeze({
    frozenInput,
    templates,
    limits,
    compilerPolicy,
    models: copied.models,
  });
}
