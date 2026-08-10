import { describe, expect, it } from 'vitest';
import { runPilotMatcher, type MatcherInput } from './index';
import requestBundle from '../../../../tests/fixtures/matching/golden/D1-single-exact/request.json';
import catalogBundle from '../../../../tests/fixtures/matching/golden/shared/catalog-main.json';
import policy from '../../../../tests/fixtures/matching/golden/D1-single-exact/policy.json';
import registry from '../../../../matching/policies/pilot-v1.json';

describe('browser-first matching adapter', () => {
  it('runs an exact match and computes a Web Crypto SHA-256 fingerprint', async () => {
    const input = {
      requestBundle,
      catalogs: [{ catalogRecordId: 'record-main', bundle: catalogBundle }],
      policy,
      registry,
      engineVersion: 'pilot-1.0.0',
    } as unknown as MatcherInput;

    const result = await runPilotMatcher(input);

    expect(result.kind).toBe('match_result');
    expect(result.lines[0]).toMatchObject({ resolution: 'single_exact' });
    expect(result.input_fingerprint).toBe('eb141e2cd2fed1996be6afccbceda9f4cf684a58c67b6ec72bd376f63ec854a1');
    expect(result.input_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
