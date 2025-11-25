import { TranslateMode } from '../types/enums';
import {
    ALWAYS_SKIP_TAGS,
    TRANSLATABLE_ATTRIBUTES,
    TRANSLATE_ATTRIBUTES,
    CLASS_TRANSLATE_VALUES,
    TERMINAL_TAGS,
    TEXTAREA_TAGS,
    HTML_ENTITY_REGEX,
    TAG_REGEX,
    NUMBER_REGEX,
    NUMBER_PLACEHOLDER
} from './constants';
import { getElementAttribute } from '../utils/helpers';
import { getComputedStyleProperty } from '../utils/dom-helpers';
import { isIframeAccessible } from '../utils/dom-helpers';

/**
 * Set of elements that should not be translated
 */
const skipTranslationElements = new Set<Node>();

/**
 * Get list of translatable attributes for element
 */
export function getTranslatableAttributes(element: Element): string[] {
    if (!element || typeof element.nodeName !== 'string') {
        return [];
    }

    const attributes = new Set<string>();
    const configs = TRANSLATABLE_ATTRIBUTES.get(element.nodeName);

    if (configs) {
        for (let i = 0; i < configs.length; i++) {
            if (configs[i].predicate(element) === true) {
                for (let j = 0; j < configs[i].attributes.length; j++) {
                    const attrValue = element.getAttribute(configs[i].attributes[j]);
                    if (attrValue && attrValue.length > 0 && attrValue.trim().length > 0) {
                        attributes.add(configs[i].attributes[j]);
                    }
                }
            }
        }
    }

    if (element.hasAttribute('aria-label')) {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.length > 0) {
            attributes.add('aria-label');
        }
    }

    return [...attributes];
}

/**
 * Check if node is translatable
 */
export function isNodeTranslatable(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        return true;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    const element = node as Element;

    if (!isIframeAccessible(element as HTMLIFrameElement) && 
        !element.hasChildNodes() && 
        !(element.nodeName in TRANSLATABLE_ATTRIBUTES)) {
        return false;
    }

    if (ALWAYS_SKIP_TAGS.has(element.nodeName.toLowerCase())) {
        return false;
    }

    if (getTranslateMode(element) === TranslateMode.Off) {
        return false;
    }

    if (isIframeAccessible(element as HTMLIFrameElement)) {
        return true;
    }

    return hasTranslatableContent(element);
}

/**
 * Check if element has translatable content
 */
function hasTranslatableContent(element: Element): boolean {
    if (!element || (!element.children && !(element as any).shadowRoot)) {
        return false;
    }

    const stack = [0];
    let current: Element | null = element;

    while (stack.length > 0 && current) {
        if (stack.length >= 5) {
            return true;
        }

        const topIndex = stack.length - 1;

        if ((current as any).shadowRoot) {
            return true;
        }

        if (!current.children || stack[topIndex] >= current.children.length) {
            stack.pop();
            if (stack.length === 0) break;
            current = current.parentNode as Element;
        } else {
            const child: Element = current.children[stack[topIndex]];
            
            if (isIframeAccessible(child as HTMLIFrameElement)) {
                return true;
            }

            if (getTranslatableAttributes(child).length > 0) {
                return true;
            }

            current = child;
            stack[topIndex] = stack[topIndex] + 1;
            stack.push(0);
        }
    }

    const textContent = current?.textContent;
    return !!(textContent && hasTranslatableText(textContent));
}

/**
 * Get element translation mode
 */
export function getTranslateMode(element: Element): TranslateMode {
    let mode = TranslateMode.Inherit;

    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return mode;
    }

    for (const attributeName of TRANSLATE_ATTRIBUTES.keys()) {
        const attributeValue = getElementAttribute(element, attributeName);
        if (attributeValue != null) {
            const valueMap = TRANSLATE_ATTRIBUTES.get(attributeName);
            mode = valueMap?.get(attributeValue.toString().toLowerCase()) || mode;
            if (mode === TranslateMode.Off) {
                return mode;
            }
        }
    }

    const className = getElementAttribute(element, 'class') || getElementAttribute(element, 'className');
    if (className != null) {
        const classes = className.toString().split(' ');
        for (let i = 0; i < classes.length; i++) {
            mode = CLASS_TRANSLATE_VALUES.get(classes[i].toLowerCase()) || mode;
            if (mode === TranslateMode.Off) {
                return mode;
            }
        }
    }

    return mode;
}

/**
 * Check if element is in skip set
 */
export function isInSkipSet(element: Node): boolean {
    skipTranslationElements.forEach(node => {
        if (node.contains(element)) {
            return true;
        }
    });
    return false;
}

/**
 * Add element to skip set
 */
export function addToSkipSet(element: Node): void {
    skipTranslationElements.add(element);
}

/**
 * Check if text is translatable
 */
export function hasTranslatableText(text: string): boolean {
    const regex = new RegExp(
        '[a-zA-Z0-9\\?!' +
        String.fromCodePoint(191) +
        String.fromCodePoint(161) +
        '.,:\\|' +
        String.fromCodePoint(192) +
        '-' +
        String.fromCodePoint(65535) +
        ']'
    );
    return regex.test(text);
}

/**
 * Check if node is inline node
 */
export function isInlineNode(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
        return true;
    }

    if (node.nodeName && TERMINAL_TAGS.has(node.nodeName.toLowerCase())) {
        return true;
    }

    if (node.nodeType === Node.ELEMENT_NODE &&
        !(node as any)._tkChunk &&
        getComputedStyleProperty(node, 'display').toLowerCase() === 'inline' &&
        getComputedStyleProperty(node, 'position').toLowerCase() === 'static' &&
        Array.from(node.childNodes).every(child => isInlineNode(child))) {
        return true;
    }

    return false;
}

/**
 * Normalize element to HTML string
 */
export function normalizeElement(element: Element, prefix: string, level: number = 1): string {
    if (level > 9) {
        return '';
    }

    const result: string[] = [];
    let elementIndex = 0;

    for (let i = 0; i < element.childNodes.length; ++i) {
        const child = element.childNodes[i];

        switch (child.nodeType) {
            case Node.ELEMENT_NODE: {
                const tagName = prefix + level.toString() + elementIndex.toString();
                const translateMode = getTranslateMode(child as Element);
                const prevSibling = child.previousSibling;
                const nextSibling = child.nextSibling;

                if (translateMode === TranslateMode.Off && 
                    prevSibling && 
                    prevSibling.nodeType === Node.ELEMENT_NODE) {
                    (prevSibling as any)._tkSkipNext = elementIndex;
                } else if (translateMode === TranslateMode.Off && 
                           nextSibling && 
                           nextSibling.nodeType === Node.ELEMENT_NODE) {
                    (nextSibling as any)._tkSkipPrev = elementIndex;
                } else {
                    result.push('<');
                    result.push(tagName);
                    result.push('>');
                    
                    if (translateMode !== TranslateMode.Off) {
                        result.push(normalizeElement(child as Element, prefix, level + 1));
                    }
                    
                    result.push('</');
                    result.push(tagName);
                    result.push('>');
                }

                ++elementIndex;
                break;
            }
            case Node.TEXT_NODE: {
                const nodeValue = child.nodeValue;
                if (nodeValue) {
                    result.push(escapeHtmlText(nodeValue));
                }
                break;
            }
        }
    }

    return result.join('');
}

/**
 * Escape HTML text
 */
export function escapeHtmlText(text: string): string {
    if (!text) return text;

    const escaped = text
        .replace(HTML_ENTITY_REGEX.AMP, '&amp;')
        .replace(HTML_ENTITY_REGEX.LT, '&lt;')
        .replace(HTML_ENTITY_REGEX.GT, '&gt;')
        .replace(TAG_REGEX.WHITESPACE, ' ');

    const hasLeadingSpace = /^\s/.test(escaped);
    const hasTrailingSpace = /\s$/.test(escaped);

    return (hasLeadingSpace ? ' ' : '') + escaped.trim() + (hasTrailingSpace ? ' ' : '');
}

/**
 * Sanitize HTML tags
 */
export function sanitizeHtml(html?: string): string | undefined {
    return html?.replace(TAG_REGEX.NON_B_TAG, (match) => {
        return match
            .replace(HTML_ENTITY_REGEX.AMP, '&amp;')
            .replace(HTML_ENTITY_REGEX.LT, '&lt;')
            .replace(HTML_ENTITY_REGEX.GT, '&gt;');
    });
}

/**
 * Replace numbers with placeholder
 */
export function maskNumbers(text: string): { replacedStr: string; hasChanged: boolean } {
    let hasChanged = false;
    const replacedStr = text.replace(NUMBER_REGEX, () => {
        hasChanged = true;
        return NUMBER_PLACEHOLDER;
    });
    return { replacedStr, hasChanged };
}

/**
 * Restore numbers from placeholder
 */
export function unmaskNumbers(text: string, numbers: string[]): string {
    let result = text;
    while (numbers.length !== 0) {
        result = result.replace(NUMBER_PLACEHOLDER, numbers.shift()!);
    }
    return result;
}

/**
 * Extract numbers from text
 */
export function extractNumbers(text: string, numbers: string[]): void {
    text.replace(NUMBER_REGEX, (match) => {
        numbers.push(match);
        return NUMBER_PLACEHOLDER;
    });
}

/**
 * Check if element is textarea
 */
export function isTextArea(element: Element): boolean {
    return !!(element.nodeName && TEXTAREA_TAGS.has(element.nodeName.toLowerCase()));
}

