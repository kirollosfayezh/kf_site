import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during the build-time render and during hydration, true afterwards.
 *
 * For the few things that legitimately differ between the build machine and
 * the visitor's browser — the ICU data behind `Intl.DisplayNames`, the time
 * zone — and must therefore render the server's version first and the
 * visitor's version a frame later, rather than mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
