import { logger } from './logger';

/**
 * Get computed style property
 */
export function getComputedStyleProperty(element: Node, property: string): string {
    if (element.nodeType !== Node.ELEMENT_NODE) return '';
    
    const styles = window.getComputedStyle(element as Element);
    const formattedProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
    
    return styles && styles[formattedProperty as any] || '';
}

/**
 * Get iframe depth
 */
export function getIframeDepth(iframe: HTMLIFrameElement): number {
    try {
        let depth = 0;
        let win: Window | null = iframe.contentWindow;
        
        while (win && win !== top) {
            depth++;
            win = win.parent;
        }
        
        return depth;
    } catch (error) {
        logger.debug(error);
        return 11;
    }
}

/**
 * Check if iframe is accessible
 */
export function isIframeAccessible(iframe: HTMLIFrameElement): boolean {
    try {
        return !!(
            iframe.contentWindow &&
            iframe.contentWindow.document &&
            iframe.contentWindow.document.documentElement &&
            iframe.contentWindow.document.body &&
            getIframeDepth(iframe) <= 10
        );
    } catch (error) {
        return false;
    }
}

/**
 * Check if iframe has valid document
 */
export function hasIframeDocument(element: any): boolean {
    try {
        return !!(element && element.contentWindow && element.contentWindow.document);
    } catch (error) {
        return false;
    }
}
