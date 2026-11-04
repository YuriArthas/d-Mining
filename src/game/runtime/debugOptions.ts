/** Diagnostics are opt-in. Other query parameters cannot enable them. */
export function debugOptions(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search);
  const enabled = params.get('debug') === '1';
  return {
    enabled,
    kit: enabled && params.get('kit') === '1',
    previewLayer: enabled ? params.get('layer') : null,
    framesInFlight: enabled && params.get('framesInFlight') === '1' ? 1 as const : 2 as const,
    submission: enabled && params.get('submission') === 'fenced' ? 'fenced' as const : 'browser' as const,
    gpuTiming: enabled && params.get('gpuTiming') === '1',
    mergeTextGroups: !enabled || params.get('textGroups') !== '0',
  };
}
