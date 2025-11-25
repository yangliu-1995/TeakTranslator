import { logger } from '../utils/logger';
import { TK_ATTRIBUTES } from './constants';
import { hasIframeDocument } from '../utils/dom-helpers';

/**
 * Set element attribute
 */
function setElementAttribute(element: Element, attributeName: string, value: string): void {
    switch (attributeName) {
        case 'aria-label':
            element.setAttribute('aria-label', value);
            break;
        case 'value':
            element.setAttribute('value', value);
            break;
        case 'alt':
            element.setAttribute('alt', value);
            break;
        case 'placeholder':
            element.setAttribute('placeholder', value);
            break;
        case 'label':
            element.setAttribute('label', value);
            break;
        case '_tkvalue':
             element.setAttribute('_tkvalue', value);
            break;
        case '_tkalt':
            element.setAttribute('_tkalt', value);
            break;
        case '_tkplaceholder':
            element.setAttribute('_tkplaceholder', value);
            break;
        case '_tkaria-label':
            element.setAttribute('_tkaria-label', value);
            break;
        case '_tklabel':
            element.setAttribute('_tklabel', value);
            break;
    }
}

/**
 * Untranslate element (restore translation)
 */
export function untranslateElement(element: Element | null): void {
    if (!element) return;

    // Handle shadow DOM
    if ((element as any).shadowRoot) {
        for (const child of (element as any).shadowRoot.children) {
            untranslateElement(child);
        }
    }

    // Handle iframe
    const nodeName = element.nodeName.toLowerCase();
    if (nodeName === 'frame' || nodeName === 'iframe') {
        const iframe = element as HTMLIFrameElement;
        const iframeDoc = iframe.contentWindow?.document.documentElement;
        try {
            if (iframeDoc) {
                untranslateElement(iframeDoc);
            }
        } catch (error) {
            // Ignore cross-origin errors
        }
    } else {
        // Restore style
        const tkStyle = (element as any)._tkStyle;
        if (tkStyle) {
            for (const prop in tkStyle) {
                try {
                    (element as any).style[prop] = tkStyle[prop];
                } catch (error) {
                    logger.error(error);
                }
            }
        }
        (element as any)._tkStyle = null;

        // Restore attributes
        const tkSrcAttribute = (element as any)._tkSrcAttribute;
        if (tkSrcAttribute) {
            for (const attr in tkSrcAttribute) {
                setElementAttribute(element, attr, tkSrcAttribute[attr]);
            }
        }

        // Remove TK attributes
        TK_ATTRIBUTES.forEach(attr => {
            element.removeAttribute?.(attr);
        });

        // Restore HTML content
        const tkSrcHtml = (element as any)._tkSrcHtml;
        if (tkSrcHtml && tkSrcHtml.childNodes.length > 0) {
            while (element.childNodes.length > 0 && element.lastChild) {
                element.removeChild(element.lastChild);
            }

            while (tkSrcHtml.childNodes.length > 0) {
                element.appendChild(tkSrcHtml.childNodes[0]);
            }

            (element as any)._tkSrcHtml = undefined;
        } else {
            // Recursively process child elements
            for (let i = 0; i < element.childNodes.length; ++i) {
                try {
                    const child = element.childNodes[i];
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        untranslateElement(child as Element);
                    }
                } catch (error) {
                    // Ignore errors
                }
            }
        }
    }
}

/**
 * Untranslate title element
 */
export function untranslateTitleElement(): void {
    const titleElement = document.querySelector('head > title');
    if (titleElement) {
        untranslateElement(titleElement);
    }
}
