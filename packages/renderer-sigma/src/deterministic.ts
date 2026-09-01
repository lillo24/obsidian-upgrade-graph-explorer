export function stableHash32(value: string, seed = 2_166_136_261): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function stableUnit(value: string, seed: number): number {
  return stableHash32(value, seed) / 0xffff_ffff;
}
