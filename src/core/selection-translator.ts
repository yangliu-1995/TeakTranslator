import { PageTranslator, setTranslatorInstance } from './page-translator';
import { TranslateDataCallbacks } from '../types/interfaces';
import { logger } from '../utils/logger';
import { translationState } from '../utils/state';

/**
 * Get common ancestor container of selection range
 */
function getSelectionCommonAncestor(win: Window | null): Element | null {
    if (!win) {
        return null;
    }

    const selection = win.getSelection();
    let range: Range | undefined;

    const activeElement = win.document.activeElement;

    if (activeElement && 
        selection && 
        activeElement.nodeType === Node.ELEMENT_NODE && 
        activeElement.nodeName === 'A' && 
        !selection.containsNode(activeElement, true)) {
        range = win.document.createRange();
        range.selectNode(activeElement);
        selection.removeAllRanges();
        selection.addRange(range);
        return activeElement;
    }

    if (!selection || selection.isCollapsed || selection.rangeCount < 1) {
        return null;
    }

    range = selection.getRangeAt(0);

    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    let endOffset = range.endOffset;

    if (startContainer.nodeType === Node.TEXT_NODE && 
        startOffset !== 0 && 
        startContainer.parentNode && 
        startContainer.nodeValue) {
        startContainer.parentNode.insertBefore(
            document.createTextNode(startContainer.nodeValue.substring(0, startOffset)),
            startContainer
        );
        (startContainer as Text).nodeValue = startContainer.nodeValue.substring(startOffset);
        range.setStart(startContainer, 0);

        if (startContainer === endContainer) {
            endOffset -= startOffset;
        }
    }

    if (endContainer.nodeType === Node.TEXT_NODE && 
        endContainer.nodeValue && 
        endOffset !== endContainer.nodeValue.length) {
        endContainer.parentNode?.insertBefore(
            document.createTextNode(endContainer.nodeValue.substring(endOffset)),
            endContainer.nextSibling
        );
        (endContainer as Text).nodeValue = endContainer.nodeValue.substring(0, endOffset);
        range.setEnd(endContainer, endContainer.nodeValue.length);
    }

    selection.removeAllRanges();
    selection.addRange(range);

    return range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentNode as Element 
        : range.commonAncestorContainer as Element;
}

/**
 * Translate selected text
 */
export function translateSelection(
    toLang: string,
    onIntermediateComplete: () => void,
    translateDataCallbacks: TranslateDataCallbacks,
    onError?: (error: string) => void
): Promise<any> {
    translationState.translationStartTime = performance.now();

    const commonAncestors: Element[] = [];
    let ancestor = getSelectionCommonAncestor(window);
    
    if (ancestor) {
        commonAncestors.push(ancestor);
    }

    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
        try {
            ancestor = getSelectionCommonAncestor(iframes[i].contentWindow);
            if (ancestor) {
                commonAncestors.push(ancestor);
            }
        } catch (error) {
            // Ignore cross-origin errors
        }
    }

    const handleError = (error: string) => {
        logger.error('Error occurred while translating selection. Details: ' + error);
        setTranslatorInstance(null);
        
        if (typeof onError === 'function') {
            onError(error);
        }
    };

    function translateAncestor(ancestor: Element): Promise<void> {
        return new Promise((resolve, reject) => {
            const translator = new PageTranslator(
                ancestor,
                '',
                toLang,
                resolve,
                (error: any) => {
                    handleError(error);
                    reject(error);
                },
                onIntermediateComplete,
                true,
                false,
                translateDataCallbacks
            );

            setTranslatorInstance(translator);
            translator.executeTranslation();
        });
    }

    let promise: Promise<void> = Promise.resolve();

    for (let i = 0; i < commonAncestors.length; i++) {
        promise = promise.then(translateAncestor.bind(null, commonAncestors[i]));
    }

    return promise.catch((error) => {
        logger.error('Failed to translate the text selection(s)', error);
        handleError(error);
        return Promise.reject(error);
    });
}

