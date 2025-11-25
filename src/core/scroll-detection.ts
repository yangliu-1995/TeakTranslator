import { logger } from '../utils/logger';
import { registerScrollListener, removeScrollListener } from './event-handlers';
import { deferExecution } from '../utils/helpers';

const windowRef = window;

/**
 * Register scroll stop detection
 */
export function registerScrollStopDetection(onScrollStopped: () => void): void {
    const checkScrollStopped = () => {
        let lastScrollX = window.scrollX;
        let lastScrollY = window.scrollY;
        let noScrollCount = 0;

        const checkScroll = () => {
            const currentScrollX = window.scrollX;
            const currentScrollY = window.scrollY;

            if (lastScrollX === currentScrollX && lastScrollY === currentScrollY) {
                noScrollCount++;
            } else {
                lastScrollX = currentScrollX;
                lastScrollY = currentScrollY;
                noScrollCount = 0;
            }

            if (noScrollCount >= 6) {
                logger.debug('Scrolling has stopped.');
                registerScrollListener(checkScrollStopped);
                deferExecution(onScrollStopped);
            } else {
                windowRef.requestAnimationFrame(checkScroll);
            }
        };

        windowRef.requestAnimationFrame(checkScroll);
    };

    registerScrollListener(checkScrollStopped);
}
