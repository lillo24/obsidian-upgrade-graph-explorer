import type { JsonValue } from './types';

const encoder = new TextEncoder();

export function utf8Bytes(value: string): number {
  return encoder.encode(value).byteLength;
}

export function assertPlainData(
  value: unknown,
  label: string,
): asserts value is JsonValue {
  const seen = new Set<object>();

  const visit = (candidate: unknown, path: string): void => {
    if (
      candidate === null ||
      typeof candidate === 'string' ||
      typeof candidate === 'boolean'
    ) {
      return;
    }
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) {
        throw new TypeError(
          `${label}${path} must contain only finite numbers.`,
        );
      }
      return;
    }
    if (typeof candidate !== 'object') {
      throw new TypeError(`${label}${path} is not JSON-compatible plain data.`);
    }
    if (seen.has(candidate)) {
      throw new TypeError(`${label}${path} contains a cycle.`);
    }
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else {
      const prototype = Object.getPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`${label}${path} must be a plain object.`);
      }
      for (const [key, item] of Object.entries(candidate)) {
        visit(item, `${path}.${key}`);
      }
    }
    seen.delete(candidate);
  };

  visit(value, '');
}

export function clonePlainData<T>(value: T): T {
  assertPlainData(value, 'Value');
  return structuredClone(value);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key] ?? null)}`)
    .join(',')}}`;
}

export function stableStringify(value: unknown): string {
  assertPlainData(value, 'Stable-stringify input');
  return canonicalize(value);
}

export function deterministicFingerprint(value: unknown): string {
  assertPlainData(value, 'Fingerprint input');
  const bytes = encoder.encode(stableStringify(value));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64-${hash.toString(16).padStart(16, '0')}`;
}

export function plainDataByteLength(value: unknown): number {
  assertPlainData(value, 'Byte-length input');
  return utf8Bytes(JSON.stringify(value));
}

const SENSITIVE_METADATA_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'credential',
  'credentials',
  'password',
  'secret',
  'access_token',
  'refresh_token',
]);

export function assertSafeMetadata(value: unknown, label: string): void {
  assertPlainData(value, label);
  const visit = (candidate: JsonValue, path: string): void => {
    if (candidate === null || typeof candidate !== 'object') return;
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, item] of Object.entries(candidate)) {
      if (SENSITIVE_METADATA_KEYS.has(key.toLocaleLowerCase())) {
        throw new Error(
          `${label}${path}.${key} uses a credential-like key that cannot be persisted in review metadata.`,
        );
      }
      visit(item, `${path}.${key}`);
    }
  };
  visit(value, '');
}
