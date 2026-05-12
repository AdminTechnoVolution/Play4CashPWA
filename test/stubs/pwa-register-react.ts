/**
 * Vitest stub for `virtual:pwa-register/react`.
 *
 * This file is aliased in `vitest.config.ts` so spec files can `vi.mock` the export and
 * provide deterministic behavior. The default export below is just a no-op fallback in
 * case a spec forgets to mock it explicitly.
 */
export interface UseRegisterSWReturn {
  needRefresh: [boolean, (v: boolean) => void];
  offlineReady: [boolean, (v: boolean) => void];
  updateServiceWorker: (reload?: boolean) => Promise<void>;
}

export function useRegisterSW(_opts?: {
  immediate?: boolean;
  onRegisteredSW?: (swUrl: string, registration: unknown) => void;
}): UseRegisterSWReturn {
  return {
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: async () => undefined,
  };
}
