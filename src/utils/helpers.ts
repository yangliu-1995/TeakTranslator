/**
 * Freeze Map object
 */
export function freezeMap<K, V>(obj: Record<string, V>): ReadonlyMap<K, V> {
    return Object.freeze(new Map(Object.entries(obj)) as Map<K, V>);
}

/**
 * Freeze object
 */
export function freezeObject<T>(obj: T): Readonly<T> {
    return Object.freeze(obj);
}

/**
 * Calculate byte count of string
 */
export function getStringBytes(str: string | null): number {
    return str ? encodeURIComponent(str).replace(/%\w\w/g, ' ').length : 0;
}

/**
 * Get element attribute
 */
export function getElementAttribute(element: Node, attribute: string): string | null {
    return element.nodeType === Node.ELEMENT_NODE 
        ? (element as Element).getAttribute(attribute) || (element as any)[attribute] 
        : null;
}

/**
 * Defer function execution
 */
export function deferExecution<T extends any[]>(fn: (...args: T) => void, ...args: T): void {
    Promise.resolve().then(() => fn(...args));
}

/**
 * Calculate text hash
 */
export function calculateTextHash(text: string | null): string {
    let hash = 0;
    if (text) {
        const cleanedText = text.replace(/[\s\xA0]/g, '');
        for (let i = 0; i < cleanedText.length; ++i) {
            hash += 13 * cleanedText.charCodeAt(i) * (i + 7);
        }
    }
    return hash.toString();
}

/**
 * Get element hash attribute
 */
export function getElementHash(element: Element): string | null {
    return element.getAttribute('_tkHash');
}

/**
 * Convert type to string
 */
export function typeToString(value: any): string {
    const getType = (val: any): string => {
        let type: string = typeof val;
        if (type === 'object') {
            if (val === null) {
                return 'null';
            } else if (Object.prototype.toString.call(val) === '[object Array]') {
                return 'array';
            }
        }
        return type;
    };

    const valueType = getType(value);
    
    if (valueType === 'object' || valueType === 'array') {
        return JSON.stringify(value);
    } else if (valueType === 'null') {
        return 'null';
    } else if (valueType === 'undefined') {
        return 'undefined';
    } else {
        return value.toString();
    }
}

