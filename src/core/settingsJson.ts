/**
 * Backwards-compatible Claude helpers. New code uses the selected harness
 * adapter, while focused callers can keep importing these original names.
 */
import { getHarness } from './harness';
import type { MergeResult, StripResult } from './hookConfig';

export function mergeBranchGuardHooks(existing: string | null): MergeResult {
  return getHarness('claude').mergeHookConfig(existing);
}

export function stripBranchGuardHooks(existing: string): StripResult {
  return getHarness('claude').stripHookConfig(existing);
}
