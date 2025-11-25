import { RequestType } from './enums';

/**
 * Translation response interface
 */
export interface TranslateResponse {
    TranslatedText: string;
    From: string;
    RequiresUnmasking?: boolean;
}

/**
 * Translation request interface
 */
export interface TranslateRequest {
    element: Element;
    requestType: RequestType;
    text: string;
    attributeName?: string;
}

/**
 * Traversal stack interface
 */
export interface TraversalStack {
    domStack: Stack<Node>;
    properties: Stack<StackProperty>;
    offsetFromStart: Stack<number>;
    hidden: Stack<number>;
    elements: Stack<number>;
}

/**
 * Stack property interface
 */
export interface StackProperty {
    isRoot: boolean;
    traverseTerminalOnly: boolean;
}

/**
 * Promise resolver interface
 */
export interface PromiseResolver<T> {
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}

/**
 * Translation text item interface
 */
export interface TranslateTextItem {
    originalText: string;
    maskedText: string;
    requiresUnmasking: boolean;
}

/**
 * Task interface
 */
export interface Task {
    rafRequestId: number | null;
    isCompleted: boolean;
}

/**
 * Stack interface
 */
export interface Stack<T> {
    items: T[];
    first: T | undefined;
    top: T | undefined;
    length: number;
    pop(): T | undefined;
    shift(): T | undefined;
    push(item: T): number;
    get(index: number): T | undefined;
    clear(): void;
    isEmpty(): boolean;
    [Symbol.iterator](): Iterator<T>;
}

/**
 * Translation data callbacks interface
 */
export interface TranslateDataCallbacks {
    onTranslateApiCalled: () => void;
    incrementTotalCharacterTranslated: (count: number) => void;
}

/**
 * Apply style interface
 */
export interface ApplyStyle {
    direction: string;
    textAlign: string;
}
