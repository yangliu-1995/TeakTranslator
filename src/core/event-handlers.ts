/**
 * Event handler management
 */

const windowRef = window;
let scrollController: AbortController | undefined;
let visibilityController: AbortController | undefined;

/**
 * Register scroll event listener
 */
export function registerScrollListener(handler: (event: Event) => void): void {
    removeScrollListener();
    scrollController = new AbortController();
    windowRef.addEventListener('scroll', handler, {
        capture: true,
        once: true,
        signal: scrollController.signal
    });
}

/**
 * Remove scroll event listener
 */
export function removeScrollListener(): void {
    scrollController?.abort();
    scrollController = undefined;
}

/**
 * Remove visibility event listener
 */
export function removeVisibilityListener(): void {
    visibilityController?.abort();
    visibilityController = undefined;
}

/**
 * Register visibility change listener
 */
export function registerVisibilityListener(
    document: Document,
    handler: () => void
): void {
    removeVisibilityListener();
    visibilityController = new AbortController();
    document.addEventListener('visibilitychange', handler, {
        signal: visibilityController.signal
    });
}
