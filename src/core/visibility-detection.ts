import { VisibilityState } from '../types/enums';
import { TK_HIDDEN, TK_VISIBLE } from './constants';
import { GenericStack } from '../data-structures/stack';
import { ElementChunkStore } from './element-chunk';

/**
 * Detect element visibility
 */
export function detectElementVisibility(element: Node): number {
    try {
        let targetElement = normalizeElementForVisibility(element);
        const elementNode = targetElement.nodeType === Node.ELEMENT_NODE 
            ? targetElement as Element 
            : (targetElement.parentElement as Element);

        let rect: DOMRect | undefined;

        if (['title'].includes(element.nodeName.toLowerCase())) {
            return VisibilityState.insideView;
        }

        if (elementNode && elementNode.nodeType === Node.ELEMENT_NODE) {
            rect = elementNode.getBoundingClientRect();
        }

        if (!rect) {
            return VisibilityState.insideView;
        }

        if (rect.height === 0 || rect.width === 0) {
            return VisibilityState.hidden;
        }

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        
        if ((rect.top >= 0 && rect.top <= viewportHeight + 1000) ||
            (rect.bottom >= 0 && rect.bottom <= viewportHeight + 1000)) {
            return VisibilityState.insideView;
        }

        return VisibilityState.outsideView;
    } catch (error) {
        return VisibilityState.insideView;
    }
}

/**
 * Normalize element for visibility detection
 */
function normalizeElementForVisibility(element: Node): Node {
    if (element && 
        element.nodeType === Node.ELEMENT_NODE && 
        ['option', 'optgroup'].includes(element.nodeName.toLowerCase())) {
        const select = (element as Element).closest('select');
        if (select) {
            return select;
        }
    }
    return element;
}

/**
 * Check if element is in view
 */
export function isElementInView(element: Node): boolean {
    return detectElementVisibility(element) === VisibilityState.insideView;
}

/**
 * Record element state
 */
export function recordElementState(
    visibility: number,
    hiddenStack: GenericStack<number>,
    elementsStack: GenericStack<number>
): void {
    if (visibility & VisibilityState.unknown) {
        return;
    }

    elementsStack.items[elementsStack.length - 1]++;

    if (visibility & VisibilityState.hidden) {
        hiddenStack.items[hiddenStack.length - 1]++;
    }
}

/**
 * Merge stack state
 */
export function mergeStackState(
    domStack: GenericStack<Node>,
    hiddenStack: GenericStack<number>,
    elementsStack: GenericStack<number>
): void {
    if (hiddenStack.top && hiddenStack.top > 0 && 
        hiddenStack.top === elementsStack.top && 
        domStack.length > 0 && 
        domStack.top?.nodeType === Node.ELEMENT_NODE) {
        (domStack.top as Element).setAttribute(TK_HIDDEN, hiddenStack.top.toString());
    }

    let hiddenCount = hiddenStack.pop();
    if (hiddenStack.length > 0 && hiddenCount !== undefined) {
        hiddenStack.items[hiddenStack.length - 1] += hiddenCount;
    }

    let elementsCount = elementsStack.pop();
    if (elementsStack.length > 0 && elementsCount !== undefined) {
        elementsStack.items[elementsStack.length - 1] += elementsCount;
    }
}

/**
 * Mark nodes as visible
 */
export function markNodesAsVisible(
    element: Element,
    onAttributeFound: (element: Element, name: string, value: string) => void,
    onTextFound: (element: Element, text: string) => void,
    chunkStore: ElementChunkStore
): number {
    interface QueueItem {
        node: Element;
        depth: number;
    }

    const queue = new GenericStack<QueueItem>();
    queue.push({ node: element, depth: 0 });

    let processedCount = 0;

    while (!queue.isEmpty()) {
        const item = queue.pop();
        if (!item) break;

        if (item.node.hasAttribute(TK_VISIBLE)) {
            continue;
        }

        item.node.setAttribute(TK_VISIBLE, item.depth.toString());
        item.node.removeAttribute(TK_HIDDEN);

        const chunk = chunkStore.getElementChunk(item.node);
        chunkStore.removeElementChunk(item.node);

        if (chunk) {
            for (const attrName of chunk.getAllAttributes()) {
                const attrValue = chunk.getAttribute(attrName);
                if (attrValue) {
                    onAttributeFound(item.node, attrName, attrValue);
                }
            }
            processedCount++;
        }

        if (chunk && chunk.elementText) {
            onTextFound(item.node, chunk.elementText);
            processedCount++;
        } else {
            if ((item.node as any).shadowRoot) {
                for (const child of (item.node as any).shadowRoot.children) {
                    queue.push({ node: child, depth: item.depth + 1 });
                }
            }

            for (let i = 0; i < item.node.children.length; i++) {
                const childDepth = item.depth + 1;
                queue.push({ node: item.node.children[i], depth: childDepth });
            }
        }
    }

    return processedCount;
}

