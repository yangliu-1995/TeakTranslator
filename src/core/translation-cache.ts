import { TranslateResponse, PromiseResolver, TranslateTextItem } from '../types/interfaces';
import { logger } from '../utils/logger';
import { sanitizeHtml, maskNumbers } from './dom-utils';
import { MAX_CHUNK_SIZE } from './constants';

/**
 * Translation cache
 */
const translationCache = new Map<string, TranslateResponse>();

/**
 * Current target language
 */
let currentTargetLanguage: string | null = null;

/**
 * Cache size (bytes)
 */
let cacheSizeBytes = 0;

/**
 * Promise resolver map
 */
const promiseResolvers = new Map<string, PromiseResolver<TranslateResponse>>();

/**
 * Pending text items queue
 */
let pendingTextItems: TranslateTextItem[] = [];

/**
 * Total pending text bytes
 */
let pendingTextBytes = 0;

/**
 * Create promise resolver
 */
export function createPromiseResolver<T>(): PromiseResolver<T> {
    let resolveFunc!: (value: T) => void;
    let rejectFunc!: (reason?: any) => void;

    const promise = new Promise<T>((resolve, reject) => {
        resolveFunc = resolve;
        rejectFunc = reject;
    });

    return {
        resolve: resolveFunc,
        reject: rejectFunc,
        promise: promise
    };
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
    if (obj == null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        const copy = new Date();
        copy.setTime((obj as Date).getTime());
        return copy as any;
    }

    if (obj instanceof Array) {
        const copy: any[] = [];
        for (let i = 0, len = obj.length; i < len; i++) {
            copy[i] = deepClone(obj[i]);
        }
        return copy as any;
    }

    if (obj instanceof Object) {
        const copy: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                copy[key] = deepClone((obj as any)[key]);
            }
        }
        return copy;
    }

    return obj;
}

/**
 * Reject promises for pending text items
 */
export function rejectPendingTextItems(textItems: TranslateTextItem[], error: any): void {
    for (const item of textItems) {
        const resolver = promiseResolvers.get(item.maskedText);
        resolver?.reject(error);
        promiseResolvers.delete(item.maskedText);
    }
}

/**
 * Process translation result
 */
export function processTranslationResult(
    textItem: TranslateTextItem,
    response: TranslateResponse
): void {
    response.TranslatedText = sanitizeHtml(response.TranslatedText) || '';
    response.RequiresUnmasking = textItem.requiresUnmasking;

    if (textItem.requiresUnmasking) {
        response.TranslatedText = maskNumbers(response.TranslatedText).replacedStr;
    }

    addToCache(textItem.maskedText, deepClone(response));

    const resolver = promiseResolvers.get(textItem.maskedText);
    if (resolver) {
        resolver.resolve(response);
        promiseResolvers.delete(textItem.maskedText);
    } else {
        logger.warning('Promise resolver not found for text, may have been resolved already.');
    }
}

/**
 * Add to cache
 */
function addToCache(text: string, response: TranslateResponse): void {
    translationCache.set(text, response);
    cacheSizeBytes += text.length + response.TranslatedText.length;

    while (translationCache.size > 1000 || cacheSizeBytes > 4000000) {
        const firstKey = translationCache.keys().next().value as string;
        if (!firstKey) break;
        
        const firstValue = translationCache.get(firstKey);
        
        if (firstValue) {
            cacheSizeBytes -= firstKey.length + firstValue.TranslatedText.length;
        }
        
        translationCache.delete(firstKey);
    }
}

/**
 * Get from cache
 */
export function getFromCache(text: string): TranslateResponse | null {
    const cached = translationCache.get(text);
    
    if (cached != null) {
        translationCache.delete(text);
        translationCache.set(text, cached);
    }
    
    return cached || null;
}

/**
 * Set target language
 */
export function setTargetLanguage(language: string): void {
    if (currentTargetLanguage != null && currentTargetLanguage === language) {
        return;
    }

    currentTargetLanguage = language;
    translationCache.clear();
}

/**
 * Get pending text items queue
 */
export function getPendingTextItems(): TranslateTextItem[] {
    return pendingTextItems;
}

/**
 * Set pending text items queue
 */
export function setPendingTextItems(items: TranslateTextItem[]): void {
    pendingTextItems = items;
}

/**
 * Get pending text bytes
 */
export function getPendingTextBytes(): number {
    return pendingTextBytes;
}

/**
 * Set pending text bytes
 */
export function setPendingTextBytes(bytes: number): void {
    pendingTextBytes = bytes;
}

/**
 * Add promise resolver
 */
export function addPromiseResolver(key: string, resolver: PromiseResolver<TranslateResponse>): void {
    promiseResolvers.set(key, resolver);
}

/**
 * Get promise resolver
 */
export function getPromiseResolver(key: string): PromiseResolver<TranslateResponse> | undefined {
    return promiseResolvers.get(key);
}

/**
 * Clear promise resolvers
 */
export function clearPromiseResolvers(): void {
    promiseResolvers.clear();
}

