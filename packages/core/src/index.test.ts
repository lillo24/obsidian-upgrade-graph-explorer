import { describe, expect, it } from 'vitest';

import representativeSnapshot from '../../../tests/fixtures/model/representative.snapshot.json';

import {
  KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION,
  validateKnowledgeSnapshot,
} from './index';

describe('core public contract', () => {
  it('exports the canonical schema version and validator', () => {
    expect(KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(validateKnowledgeSnapshot(representativeSnapshot).valid).toBe(true);
  });

  it('preserves canonical information through a JSON round trip', () => {
    const parsed: unknown = JSON.parse(JSON.stringify(representativeSnapshot));
    const result = validateKnowledgeSnapshot(parsed);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toEqual(representativeSnapshot);
    }
  });
});
