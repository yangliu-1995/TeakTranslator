import { TriggerType, TranslateMode, RequestType, VisibilityState } from '../types/enums';
import { TranslateDataCallbacks, TraversalStack, TranslateRequest, ApplyStyle } from '../types/interfaces';
import { GenericStack } from '../data-structures/stack';
import { Language } from './language';
import { logger } from '../utils/logger';
import { translationState } from '../utils/state';
import { 
    deferExecution, 
    calculateTextHash, 
    typeToString, 
    getStringBytes 
} from '../utils/helpers';
import { getComputedStyleProperty, isIframeAccessible, hasIframeDocument, getIframeDepth } from '../utils/dom-helpers';
import { 
    isNodeTranslatable, 
    getTranslateMode, 
    getTranslatableAttributes, 
    isInlineNode, 
    normalizeElement, 
    escapeHtmlText, 
    addToSkipSet, 
    isInSkipSet, 
    hasTranslatableText, 
    unmaskNumbers, 
    extractNumbers, 
    isTextArea 
} from './dom-utils';
import { 
    ALWAYS_SKIP_TAGS, 
    TK_HIDDEN, 
    TK_VISIBLE, 
    MAX_VISIBLE_TEXT_LENGTH, 
    MAX_CHUNK_SIZE, 
    HTML_ENTITY_REGEX, 
    TAG_REGEX 
} from './constants';
import { ElementChunkStore } from './element-chunk';
import { 
    detectElementVisibility, 
    isElementInView, 
    recordElementState, 
    mergeStackState, 
    markNodesAsVisible 
} from './visibility-detection';
import { untranslateElement, untranslateTitleElement } from './untranslate';
import { 
    translateText, 
    batchTranslate, 
    getQueueJobCount,
    setTranslatorInstance
} from './translation-service';
import { setTargetLanguage, clearPromiseResolvers } from './translation-cache';

// Re-export setTranslatorInstance to maintain API compatibility
export { setTranslatorInstance } from './translation-service';
import { registerScrollStopDetection } from './scroll-detection';
import { registerVisibilityListener, removeScrollListener, removeVisibilityListener } from './event-handlers';

/**
 * Traversal iteration limit
 */
let onTranslateApiCallback: (() => void) | null = null;

/**
 * Set translate API callback
 */
export function setOnTranslateApiCallback(callback: () => void): void {
    onTranslateApiCallback = callback;
}


/**
 * Page translator class
 */
export class PageTranslator {
    private _sFrom: string;
    private _sTo: string;
    private _eDomRoot: Element | null;
    private _fComplete: () => void;
    private _fError: (error: string) => void;
    private _fVisibleComplete: (isComplete: boolean) => void;
    private _fTranslateDataCallBacks: TranslateDataCallbacks;
    private _oApplyStyle: ApplyStyle | null;
    private _detectedLanguage?: string;
    private _allDetectedLanguages: Record<string, number>;
    private bTranslateSelectedTextOnly: boolean;
    private bTranslateFullPageInOneGo: boolean;
    private iScrolledElementsTranslated: number;
    private iHiddenElementsTranslated: number;
    private bOnIntermediateCompleteCalled: boolean;
    private bAutoTraversalCompleted: boolean;
    private _oMObservers: MutationObserver[];
    private oTranslateMutationTask: any;
    private _maxIframeDepthSupported: number;
    private _maxTraversalIterations: number;
    private _aTranslatedNodes: Node[];
    private bFlushedStartTerminalNode: boolean;
    private isTraverseDOMActive: boolean;
    private bSentTranslationComplete: boolean;
    private bSentTranslationError: boolean;
    private _iVisibleTxtLength: number;
    private _bAborted: boolean;
    private outsideElementChunks: ElementChunkStore;
    private visibleElementChunks: ElementChunkStore;
    private hiddenElementChunks: ElementChunkStore;
    private _bScrollingStopped: boolean;
    private _bTxtChunksFlushed: boolean;
    private fontMutation: Map<Node, number>;
    private translateMutation: Map<Node, number>;
    private attributeMutation: Map<Element, Record<string, number>>;

    constructor(
        domRoot: Element,
        fromLang: string,
        toLang: string,
        onComplete: () => void,
        onError: (error: any) => void,
        onVisibleComplete: (isComplete: boolean) => void,
        translateSelectedTextOnly: boolean,
        translateFullPageInOneGo: boolean,
        translateDataCallbacks: TranslateDataCallbacks
    ) {
        this._allDetectedLanguages = {};
        this.bTranslateSelectedTextOnly = false;
        this.bTranslateFullPageInOneGo = false;
        this.iScrolledElementsTranslated = 0;
        this.iHiddenElementsTranslated = 0;
        this.bOnIntermediateCompleteCalled = false;
        this.bAutoTraversalCompleted = false;
        this._oMObservers = [];
        this.oTranslateMutationTask = null;
        this._maxIframeDepthSupported = 10;
        this._maxTraversalIterations = 10000;
        this._aTranslatedNodes = [];
        this.bFlushedStartTerminalNode = false;
        this.isTraverseDOMActive = false;
        this.bSentTranslationComplete = false;
        this.bSentTranslationError = false;
        this._iVisibleTxtLength = 0;
        this._bAborted = false;
        this.outsideElementChunks = new ElementChunkStore();
        this.visibleElementChunks = new ElementChunkStore();
        this.hiddenElementChunks = new ElementChunkStore();
        this._bScrollingStopped = false;
        this._bTxtChunksFlushed = false;
        this.fontMutation = new Map();
        this.translateMutation = new Map();
        this.attributeMutation = new Map();

        this._sFrom = fromLang;
        this._sTo = toLang;
        this._eDomRoot = domRoot;
        this._fComplete = onComplete;
        this._fVisibleComplete = onVisibleComplete;
        this._fTranslateDataCallBacks = translateDataCallbacks;

        this._fError = (error: any) => {
            if (typeof onError === 'function') {
                try {
                    onError(typeToString(error));
                } catch (e) {
                    logger.error('Encountered exception while calling error handler', e);
                }
            }
        };

        this.bTranslateSelectedTextOnly = translateSelectedTextOnly === true;
        this.bTranslateFullPageInOneGo = translateFullPageInOneGo === true;

        setOnTranslateApiCallback(translateDataCallbacks.onTranslateApiCalled);

        this._oApplyStyle = this.calculateApplyStyle(fromLang, toLang);

        setTargetLanguage(toLang);
    }

    /**
     * Calculate apply style
     */
    private calculateApplyStyle(fromLang: string, toLang: string): ApplyStyle | null {
        if (Language.isRtl(fromLang) === Language.isRtl(toLang)) {
            return null;
        }

        return Language.isRtl(toLang) 
            ? { direction: 'rtl', textAlign: 'right' }
            : { direction: 'ltr', textAlign: 'left' };
    }

    /**
     * Get source language
     */
    getFromLanguage(): string {
        return this._sFrom;
    }

    /**
     * Get target language
     */
    getToLanguage(): string {
        return this._sTo;
    }

    /**
     * Translation complete
     */
    translationComplete(): void {
        if (translationState.requestsInitiated) {
            logger.info('Took ' + (performance.now() - translationState.translationStartTime) + ' ms to translate');
            translationState.translationStartTime = performance.now();
            translationState.requestsInitiated = false;
        }

        if (this.bSentTranslationComplete) {
            return;
        }

        this.bSentTranslationComplete = true;

        if (this._eDomRoot && this.bTranslateSelectedTextOnly && this._aTranslatedNodes.length) {
            this.selectTranslatedNodes(this._eDomRoot, this._aTranslatedNodes);

            const range = this._eDomRoot.ownerDocument.createRange();
            range.setStartBefore(this._aTranslatedNodes[0]);
            range.setEndAfter(this._aTranslatedNodes[this._aTranslatedNodes.length - 1]);

            const selection = this._eDomRoot.ownerDocument.defaultView?.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        }

        if (!this.bSentTranslationError && !this.bOnIntermediateCompleteCalled) {
            this.bOnIntermediateCompleteCalled = true;
            this._fVisibleComplete(true);
        }

        if (!this.bSentTranslationError) {
            this._fComplete();
        }
    }

    /**
     * Select translated nodes
     */
    private selectTranslatedNodes(root: Element, nodes: Node[]): void {
        if (!root || !nodes || !nodes.length) {
            return;
        }

        const stack = new GenericStack<number>();
        let swapIndex = 0;

        stack.push(0);

        let current: Node | null = root;

        while (swapIndex < nodes.length && stack.length && current) {
            const nodeIndex = nodes.indexOf(current);

            if (nodeIndex >= 0) {
                const temp = nodes[swapIndex];
                nodes[swapIndex] = nodes[nodeIndex];
                nodes[nodeIndex] = temp;
                swapIndex++;
                current = current.parentNode;
                stack.pop();
            } else {
                const stackTop = stack.top;
                if (stackTop !== undefined && stackTop < current.childNodes.length) {
                    current = current.childNodes[stackTop];
                    stack.top = stackTop + 1;
                    stack.push(0);
                } else {
                    current = current.parentNode;
                    stack.pop();
                }
            }
        }

        while (swapIndex < nodes.length) {
            nodes.pop();
        }
    }

    /**
     * Get traversal stack
     */
    getTraversalStack(root?: Node): TraversalStack {
        if (root) {
            return {
                domStack: new GenericStack([root]),
                properties: new GenericStack([{ isRoot: true, traverseTerminalOnly: false }]),
                offsetFromStart: new GenericStack([0]),
                hidden: new GenericStack([0]),
                elements: new GenericStack([0])
            };
        }

        return {
            domStack: new GenericStack(),
            properties: new GenericStack(),
            offsetFromStart: new GenericStack(),
            hidden: new GenericStack(),
            elements: new GenericStack()
        };
    }

    /**
     * Add visible element text
     */
    addVisibleElementText(element: Element, text: string): void {
        const oldBytes = this.visibleElementChunks.getElementChunk(element)?.getStringBytes() ?? 0;
        this.visibleElementChunks.addElementText(element, text);
        const newBytes = this.visibleElementChunks.getElementChunk(element)!.getStringBytes();
        this._iVisibleTxtLength += newBytes - oldBytes;
    }

    /**
     * Add visible element attribute
     */
    addVisibleElementAttribute(element: Element, name: string, value: string): void {
        const oldBytes = this.visibleElementChunks.getElementChunk(element)?.getStringBytes() ?? 0;
        this.visibleElementChunks.addElementAttributes(element, name, value);
        const newBytes = this.visibleElementChunks.getElementChunk(element)!.getStringBytes();
        this._iVisibleTxtLength += newBytes - oldBytes;
    }

    /**
     * Mark nodes as visible
     */
    markNodesAsVisible(element: Element): number {
        return markNodesAsVisible(
            element,
            (el, name, value) => this.addVisibleElementAttribute(el, name, value),
            (el, text) => this.addVisibleElementText(el, text),
            this.hiddenElementChunks
        );
    }

    /**
     * Mark nodes as outside view
     */
    markNodesAsOutsideView(element: Element): number {
        return markNodesAsVisible(
            element,
            (el, name, value) => this.outsideElementChunks.addElementAttributes(el, name, value),
            (el, text) => this.outsideElementChunks.addElementText(el, text),
            this.hiddenElementChunks
        );
    }

    /**
     * Push into traversal stack
     */
    pushIntoTraversalStack(stack: TraversalStack, node: Node, traverseTerminalOnly: boolean): void {
        stack.domStack.push(node);
        stack.properties.push({ isRoot: true, traverseTerminalOnly });
        stack.offsetFromStart.push(0);
        stack.hidden.push(0);
        stack.elements.push(0);
        this.flushChunk([node], true);
    }

    /**
     * Update added iframe
     */
    updateAddedIframe(iframe: HTMLIFrameElement): void {
        if (getIframeDepth(iframe) > this._maxIframeDepthSupported) {
            return;
        }

        if (iframe.contentWindow!.document.body) {
            this.updateAddedIframeBody(iframe);
        } else {
            iframe.contentWindow!.onload = () => this.updateAddedIframeBody(iframe);
        }
    }

    /**
     * Update iframe body
     */
    updateAddedIframeBody(iframe: HTMLIFrameElement): void {
        if (iframe.contentWindow?.document.readyState === 'complete') {
            this.addIframeForTranslation(iframe);
        } else {
            iframe.contentWindow!.document.body.onload = () => this.addIframeForTranslation(iframe);
        }
    }

    /**
     * Add iframe for translation
     */
    addIframeForTranslation(iframe: HTMLIFrameElement): void {
        const stack = this.getTraversalStack();
        this.pushIntoTraversalStack(stack, iframe, false);

        if (!this.isTraverseDOMActive) {
            this.isTraverseDOMActive = true;
            translationState.translationStartTime = performance.now();
        }

        deferExecution(this.traverseDOM, stack, TriggerType.Mutation);
        this.setMutationObserversForDocument(iframe.contentWindow!);
    }

    /**
     * Add Mutation Observer
     */
    addMutationObserver(document: Document): void {
        const terminalNodes = new Map<Node, number>();
        const nonTerminalNodes = new Map<Node, number>();

        this._oMObservers.push(new MutationObserver((mutations) => {
            let shouldTraverse = false;
            terminalNodes.clear();
            nonTerminalNodes.clear();

            mutations.forEach((mutation) => {
                this.handleMutation(mutation, terminalNodes, nonTerminalNodes, document, (value) => {
                    shouldTraverse = value;
                });
            });

            const stack = this.getTraversalStack();
            Array.from(terminalNodes.keys()).forEach(node => {
                this.pushIntoTraversalStack(stack, node, true);
            });

            Array.from(nonTerminalNodes.keys()).forEach(node => {
                this.pushIntoTraversalStack(stack, node, false);
            });

            if (shouldTraverse) {
                shouldTraverse = false;
                if (!this.isTraverseDOMActive) {
                    this.isTraverseDOMActive = true;
                    translationState.translationStartTime = performance.now();
                }
                deferExecution(this.traverseDOM, stack, TriggerType.Mutation);
            }
        }));

        this._oMObservers[this._oMObservers.length - 1].observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeOldValue: true,
            characterDataOldValue: true,
            attributeFilter: ['value', 'placeholder', 'aria-label', 'style', 'class']
        });
    }

    /**
     * Handle mutation
     */
    private handleMutation(
        mutation: MutationRecord,
        terminalNodes: Map<Node, number>,
        nonTerminalNodes: Map<Node, number>,
        document: Document,
        setShouldTraverse: (value: boolean) => void
    ): void {
        switch (mutation.type) {
            case 'characterData':
                this.handleCharacterDataMutation(mutation, terminalNodes, nonTerminalNodes, setShouldTraverse);
                break;
            case 'attributes':
                this.handleAttributeMutation(mutation, document, setShouldTraverse);
                break;
            case 'childList':
                this.handleChildListMutation(mutation, terminalNodes, nonTerminalNodes, setShouldTraverse);
                break;
        }
    }

    /**
     * Handle character data mutation
     */
    private handleCharacterDataMutation(
        mutation: MutationRecord,
        terminalNodes: Map<Node, number>,
        nonTerminalNodes: Map<Node, number>,
        setShouldTraverse: (value: boolean) => void
    ): void {
        if (this.translateMutation.has(mutation.target)) {
            const count = this.translateMutation.get(mutation.target)!;
            if (count === 1) {
                this.translateMutation.delete(mutation.target);
            } else {
                this.translateMutation.set(mutation.target, count - 1);
            }
            return;
        }

        if (isInSkipSet(mutation.target)) {
            return;
        }

        let isTerminal = true;
        let current: Node | null = mutation.target;

        while (isInlineNode(current)) {
            if (current.parentNode === null || current.parentNode === undefined) {
                isTerminal = false;
                break;
            }
            current = current.parentNode;
        }

        if (!isTerminal) {
            setShouldTraverse(true);
            this.flushChunk([mutation.target]);
            return;
        }

        const terminalElement = current as Element;

        if (current.nodeType === Node.ELEMENT_NODE && (current as Element).hasAttribute('_tkHash')) {
            if (terminalElement.hasAttribute('_tkTextHash') && 
                terminalElement.getAttribute('_tkTextHash') === calculateTextHash(current.textContent)) {
                return;
            }
            setShouldTraverse(true);
            this.flushChunk([mutation.target]);
            return;
        }

        if (!terminalNodes.has(current) && !nonTerminalNodes.has(current)) {
            setShouldTraverse(true);
            terminalNodes.set(current, 1);
        }
    }

    /**
     * Handle attribute mutation
     */
    private handleAttributeMutation(
        mutation: MutationRecord,
        document: Document,
        setShouldTraverse: (value: boolean) => void
    ): void {
        if (['style', 'class'].some(attr => attr === mutation.attributeName)) {
            const target = mutation.target as Element;
            if (mutation.target.nodeType === Node.ELEMENT_NODE && target.getAttribute(TK_HIDDEN)) {
                const visibility = detectElementVisibility(target);
                let count = 0;

                if (visibility & VisibilityState.insideView) {
                    if (document.hidden) {
                        this.markNodesAsOutsideView(target);
                        return;
                    }

                    count = this.markNodesAsVisible(target);
                    if (count === 0) {
                        logger.debug('A previously marked hidden chunk became visible but could not be located.');
                    } else {
                        this.oTranslateMutationTask = this.scheduleTask(() => {
                            this.translate(this.getTraversalStack(), TriggerType.VisibilityChange);
                        }, this.oTranslateMutationTask);
                    }
                } else if (visibility & VisibilityState.outsideView) {
                    count = this.markNodesAsOutsideView(target);
                    if (count === 0) {
                        logger.debug('A previously marked hidden chunk became un-hidden but could not be located.');
                    }
                }
            }
            return;
        }

        if (this.attributeMutation.has(mutation.target as Element)) {
            const attrs = this.attributeMutation.get(mutation.target as Element)!;
            const attrName = mutation.attributeName;
            
            if (attrName && attrName in attrs) {
                if (attrs[attrName] === 1) {
                    delete attrs[attrName];
                } else {
                    attrs[attrName] -= 1;
                }
                return;
            }
        }

        if (isInSkipSet(mutation.target)) {
            return;
        }

        setShouldTraverse(true);
        this.flushChunk([mutation.target], true);
    }

    /**
     * Handle child list mutation
     */
    private handleChildListMutation(
        mutation: MutationRecord,
        terminalNodes: Map<Node, number>,
        nonTerminalNodes: Map<Node, number>,
        setShouldTraverse: (value: boolean) => void
    ): void {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];

            if (node.nodeType === Node.ELEMENT_NODE && 
                ((node as Element).hasAttribute('_isTranslated') || 
                 (node as Element).hasAttribute('_tkMutation'))) {
                continue;
            }

            if (this.fontMutation.has(node)) {
                this.fontMutation.delete(node);
                continue;
            }

            if (this.translateMutation.has(node)) {
                const count = this.translateMutation.get(node)!;
                if (count === 1) {
                    this.translateMutation.delete(node);
                } else {
                    this.translateMutation.set(node, count - 1);
                }
                continue;
            }

            if (isInSkipSet(node)) {
                continue;
            }

            if (!isInlineNode(node)) {
                const element = node as Element;
                if (!nonTerminalNodes.has(node) && 
                    !(node.nodeType === Node.ELEMENT_NODE && 
                      element.hasAttribute('_tkHash') && 
                      element.hasAttribute('_tkTextHash') && 
                      element.getAttribute('_tkTextHash') === calculateTextHash(node.textContent))) {
                    setShouldTraverse(true);
                    nonTerminalNodes.set(node, 1);
                    if (terminalNodes.has(node)) {
                        terminalNodes.delete(node);
                    }
                }
                continue;
            }

            if (hasIframeDocument(node)) {
                const iframe = node as HTMLIFrameElement;
                if (!(iframe.hasAttribute('_tkHash') && 
                      iframe.hasAttribute('_tkTextHash') && 
                      iframe.getAttribute('_tkTextHash') === calculateTextHash(node.textContent))) {
                    this.updateAddedIframe(iframe);
                }
                continue;
            }

            let isTerminal = true;
            let current: Node | null = node;

            while (isInlineNode(current)) {
                if (current.parentNode === null || current.parentNode === undefined) {
                    isTerminal = false;
                    break;
                }
                current = current.parentNode;
            }

            if (isTerminal) {
                const element = current as Element;
                if (current.nodeType === Node.ELEMENT_NODE && element.hasAttribute('_tkHash')) {
                    if (element.nodeName.toLowerCase() === 'select') {
                        continue;
                    }

                    if (!(element.hasAttribute('_tkTextHash') && 
                          element.getAttribute('_tkTextHash') === calculateTextHash(current.textContent))) {
                        setShouldTraverse(true);
                        this.flushChunk([node]);
                    }
                } else if (!terminalNodes.has(current) && !nonTerminalNodes.has(current)) {
                    setShouldTraverse(true);
                    terminalNodes.set(current, 1);
                }
            } else {
                setShouldTraverse(true);
                this.flushChunk([node]);
            }
        }
    }

    /**
     * Schedule task
     */
    private scheduleTask(callback: () => void, currentTask: any): any {
        if (currentTask && !currentTask.isCompleted) {
            // Task already exists
        } else {
            currentTask = {
                rafRequestId: null,
                isCompleted: false
            };
        }

        if (currentTask.rafRequestId !== null) {
            cancelAnimationFrame(currentTask.rafRequestId);
        }

        currentTask.rafRequestId = requestAnimationFrame(() => {
            deferExecution(callback);
            currentTask.isCompleted = true;
        });

        return currentTask;
    }

    /**
     * Trigger traverse DOM
     */
    triggerTraverseDom(triggerType: TriggerType): void {
        this._bScrollingStopped = true;

        if (!this.isTraverseDOMActive) {
            this.isTraverseDOMActive = true;
            translationState.translationStartTime = performance.now();
        }

        this.traverseDOM(this.getTraversalStack(), triggerType);
    }

    /**
     * Set Mutation Observers for document
     */
    setMutationObserversForDocument(window: Window): void {
        if ('MutationObserver' in window && 
            !this.bTranslateSelectedTextOnly && 
            !this.bTranslateFullPageInOneGo) {
            const doc = window.document;
            this.addMutationObserver(doc);

            const iframes = doc.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
                if (iframes[i] && isIframeAccessible(iframes[i])) {
                    this.setMutationObserversForDocument(iframes[i].contentWindow!);
                }
            }
        }
    }

    /**
     * De-register event listeners
     */
    deRegisterEventListeners(): void {
        this._oMObservers.forEach(observer => observer.disconnect());
        removeScrollListener();
        removeVisibilityListener();
    }

    /**
     * Handle document visibility change
     */
    onDocumentVisibilityChange(): void {
        if (!document.hidden && !this._bAborted) {
            this.triggerTraverseDom(TriggerType.Scrolled);
        }
    }

    /**
     * Cancel translation
     */
    cancel(): void {
        const startTime = performance.now();

        this.deRegisterEventListeners();

        if (!this._eDomRoot) {
            return;
        }

        this._bAborted = true;
        clearPromiseResolvers();

        untranslateTitleElement();

        if (this.bTranslateSelectedTextOnly) {
            untranslateElement(document.body);
        } else {
            untranslateElement(this._eDomRoot);
        }

        this._eDomRoot = null;

        logger.info('Took ' + (performance.now() - startTime) + ' ms to untranslate.');
    }

    /**
     * Get detected language
     */
    getDetectedLanguage(): string | undefined {
        return this._detectedLanguage;
    }

    /**
     * Get all detected languages
     */
    getAllDetectedLanguages(): Record<string, number> {
        return this._allDetectedLanguages;
    }

    /**
     * Check if translation is paused
     */
    isTranslationPaused(): boolean {
        return this.bOnIntermediateCompleteCalled && document.hidden;
    }

    /**
     * Migrate outside chunks to visible
     */
    migrateOutsideChunksToVisible(): void {
        const shouldStop = () => !(this._iVisibleTxtLength < MAX_VISIBLE_TEXT_LENGTH || this._bScrollingStopped);
        
        const chunks = this.outsideElementChunks.getAllElementChunks();

        for (const chunk of chunks) {
            if (shouldStop()) {
                break;
            }

            const element = chunk.element;

            if (isElementInView(element)) {
                if (chunk.elementText) {
                    this.addVisibleElementText(element, chunk.elementText);
                    chunk.removeElementText();
                }

                for (const attrName of chunk.getAllAttributes()) {
                    if (shouldStop()) {
                        break;
                    }

                    const attrValue = chunk.getAttribute(attrName);
                    if (attrValue) {
                        this.addVisibleElementAttribute(element, attrName, attrValue);
                        chunk.removeAttribute(attrName);
                    }
                }

                if (chunk.isEmpty()) {
                    this.outsideElementChunks.removeElementChunk(element);
                }
            }
        }
    }

    /**
     * Get chunk store based on visibility
     */
    getChunkStoreBasedOnVisibility(visibility: number): ElementChunkStore {
        let store = this.visibleElementChunks;

        if (visibility & VisibilityState.hidden) {
            store = this.hiddenElementChunks;
        } else if (visibility & VisibilityState.outsideView || visibility & VisibilityState.unknown) {
            store = this.outsideElementChunks;
        }

        return store;
    }

    /**
     * Flush chunk
     */
    flushChunk(nodes: Node[], onlyAttributes: boolean = false): number {
        let visibility: number = VisibilityState.unknown;

        for (const node of nodes) {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }

            const element = node as Element;
            const attributes = getTranslatableAttributes(element);

            if (attributes.length > 0) {
                visibility = detectElementVisibility(element);
                if (visibility & VisibilityState.hidden) {
                    element.setAttribute(TK_HIDDEN, 'A');
                }
            }

            for (const attrName of attributes) {
                const attrValue = escapeHtmlText(element.getAttribute(attrName) || '');
                if (!attrValue) {
                    continue;
                }

                const hash = calculateTextHash(attrValue);
                const mstAttrName = '_tk' + attrName;

                if (element.hasAttribute(mstAttrName) && 
                    element.getAttribute(mstAttrName) === hash) {
                    continue;
                }

                this.setElementAttributeInternal(element, mstAttrName, hash);

                const store = this.getChunkStoreBasedOnVisibility(visibility);

                if (store === this.visibleElementChunks) {
                    if (document.hidden) {
                        this.outsideElementChunks.addElementAttributes(element, attrName, attrValue);
                    } else {
                        this.addVisibleElementAttribute(element, attrName, attrValue);
                    }
                } else {
                    store.addElementAttributes(element, attrName, attrValue);
                }

                this._bTxtChunksFlushed = true;
            }
        }

        if (onlyAttributes) {
            return visibility;
        }

        if (nodes[0] && 
            nodes[0].parentNode && 
            nodes[0].parentNode.nodeType === Node.ELEMENT_NODE) {
            const parent = nodes[0].parentNode as Element;
            if (parent.hasAttribute('_tkTextHash') && 
                parent.getAttribute('_tkTextHash') === calculateTextHash(parent.textContent)) {
                nodes.length = 0;
                return visibility;
            }
        }

        this.trimChunk(nodes);

        if (nodes.length === 0) {
            return visibility;
        }

        const chunkElement = this.chunkify(nodes);

        if (!chunkElement) {
            return visibility;
        }

        if (isTextArea(chunkElement)) {
            return visibility;
        }

        const textContent = chunkElement.textContent;
        const textHash = calculateTextHash(textContent);

        if (chunkElement.hasAttribute('_tkTextHash') && 
            chunkElement.getAttribute('_tkTextHash') === textHash) {
            return visibility;
        }

        if (chunkElement && isNodeTranslatable(chunkElement)) {
            const normalizedText = normalizeElement(chunkElement, 'b');

            if (hasTranslatableText(normalizedText)) {
                if (textContent && !textContent.isBlank()) {
                    chunkElement.setAttribute('_tkTextHash', textHash);
                }

                visibility = detectElementVisibility(chunkElement);

                let store = this.visibleElementChunks;

                if (!this.bTranslateFullPageInOneGo && !this.bTranslateSelectedTextOnly) {
                    store = this.getChunkStoreBasedOnVisibility(visibility);
                }

                if (store === this.hiddenElementChunks) {
                    chunkElement.setAttribute(TK_HIDDEN, '1');
                }

                if (store === this.visibleElementChunks) {
                    if (document.hidden) {
                        this.outsideElementChunks.addElementText(chunkElement, normalizedText);
                    } else {
                        this.addVisibleElementText(chunkElement, normalizedText);
                    }
                } else {
                    store.addElementText(chunkElement, normalizedText);
                }

                this._bTxtChunksFlushed = true;

                if (this.bTranslateSelectedTextOnly) {
                    this._aTranslatedNodes.push(chunkElement);
                }
            }
        }

        return visibility;
    }

    /**
     * Flush node array
     */
    flush(nodes: Node[], hiddenStack: GenericStack<number>, elementsStack: GenericStack<number>): void {
        if (nodes.length === 0) {
            return;
        }

        try {
            recordElementState(this.flushChunk(nodes), hiddenStack, elementsStack);
        } catch (error) {
            logger.error(error);
        }
    }

    /**
     * Identify single translatable element node
     */
    identifySingleTranslatableElementNode(element: Element, depth: number = 1): Element {
        if (element.nodeType !== Node.ELEMENT_NODE || depth > 9) {
            return element;
        }

        const children = Array.from(element.childNodes);

        while (children.length > 1 && this.canTrimNode(children[children.length - 1])) {
            children.pop();
        }

        while (children.length > 1 && this.canTrimNode(children[0])) {
            children.shift();
        }

        if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
            return this.identifySingleTranslatableElementNode(children[0] as Element, depth + 1);
        }

        return element;
    }

    /**
     * Chunkify nodes
     */
    chunkify(nodes: Node[]): Element | null {
            let result: Element | null = null;

        if (nodes.length === 0) {
            return result;
        }

        let current = nodes[0];

        if (nodes.length === 1 && current.nodeType === Node.ELEMENT_NODE) {
            result = this.identifySingleTranslatableElementNode(nodes.pop() as Element);
        } else if (current.parentNode && nodes.length === current.parentNode.childNodes.length) {
            result = nodes.pop()!.parentNode as Element;
            nodes.length = 0;
        } else {
            result = (current.ownerDocument || document).createElement('font');
            result.setAttribute('_tkMutation', '1');
            (result as any)._tkChunk = true;

            if (current.parentNode) {
                current.parentNode.insertBefore(result, current);
            }

            while (nodes.length > 0) {
                current = nodes[0];

                if (current.nodeType === Node.ELEMENT_NODE) {
                    (current as Element).setAttribute('_tkMutation', '1');
                }

                if (current.nodeType === Node.TEXT_NODE) {
                    this.fontMutation.set(current, 1);
                }

                result.appendChild(nodes.shift()!);
            }
        }

        return result;
    }

    /**
     * Trim chunk
     */
    trimChunk(nodes: Node[]): void {
        let shouldTrim = true;

        while (shouldTrim) {
            shouldTrim = false;

            if (nodes.length === 1 && !isNodeTranslatable(nodes[0])) {
                return;
            }

            if (nodes.length === 1 && 
                nodes[0].nodeType === Node.ELEMENT_NODE && 
                !isInlineNode(nodes[0]) && 
                nodes[0].childNodes.length > 0) {
                const element = nodes.pop()!;
                for (let i = 0; i < element.childNodes.length; i++) {
                    nodes.push(element.childNodes[i]);
                }
                shouldTrim = true;
            }

            if (nodes.length > 0) {
                if (this.canTrimNode(nodes[0])) {
                    nodes.shift();
                    shouldTrim = true;
                } else if (this.canTrimNode(nodes[nodes.length - 1])) {
                    nodes.pop();
                    shouldTrim = true;
                }
            }
        }

        if (nodes.length === 1 && this.canTrimNode(nodes[0])) {
            nodes.pop();
        }
    }

    /**
     * Check if node can be trimmed
     */
    canTrimNode(node: Node): boolean {
        if (this._eDomRoot && this.bTranslateSelectedTextOnly) {
            const selection = this._eDomRoot.ownerDocument.defaultView?.getSelection();
            
            if (node.nodeType === Node.TEXT_NODE && 
                !selection?.containsNode(node, false)) {
                return true;
            }

            if (node.nodeType === Node.ELEMENT_NODE && 
                !selection?.containsNode(node, true)) {
                return true;
            }
        }

        let text = '';

        switch (node.nodeType) {
            case Node.ELEMENT_NODE:
                text = node.textContent || '';
                break;
            case Node.TEXT_NODE:
                text = node.nodeValue || '';
                break;
            default:
                return true;
        }

        return !hasTranslatableText(text);
    }

    /**
     * Denormalize element recursively
     */
    denormalizeElementRecursive(
        srcElement: Element,
        translatedElement: Element,
        tagPrefix: string,
        level: number
    ): void {
        if (!srcElement || !translatedElement || typeof tagPrefix !== 'string' || typeof level !== 'number') {
            return;
        }

        if (level > 9) {
            return;
        }

        let insertIndex = 0;
        const srcElementNodes: Element[] = [];
        const srcTextNodes: Text[] = [];

        const childNodes = Array.from(srcElement.childNodes);
        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            if (child.nodeType === Node.ELEMENT_NODE) {
                srcElementNodes.push(child as Element);
            } else if (child.nodeType === Node.TEXT_NODE) {
                srcTextNodes.push(child as Text);
            }
        }

        const translatedChildNodes = Array.from(translatedElement.childNodes);
        for (let i = 0; i < translatedChildNodes.length; i++) {
            const translatedChild = translatedChildNodes[i];
            let targetNode: Node | null = null;

            if (translatedChild.nodeType === Node.TEXT_NODE) {
                if (srcTextNodes.length > 0) {
                    targetNode = srcTextNodes.shift()!;
                    const count = this.translateMutation.has(targetNode) 
                        ? this.translateMutation.get(targetNode)! + 1 
                        : 1;
                    this.translateMutation.set(targetNode, count);
                    targetNode.nodeValue = translatedChild.nodeValue;
                } else {
                    targetNode = document.createTextNode(translatedChild.nodeValue || '');
                }

        if (this.bTranslateSelectedTextOnly && 
            this._detectedLanguage && 
            Language.isRtl(this._detectedLanguage) !== Language.isRtl(this._sTo)) {
            const marker = Language.isRtl(this._sTo) 
                ? String.fromCodePoint(8207) 
                : String.fromCodePoint(8206);
            const currentValue = (targetNode as Text).nodeValue || '';
            (targetNode as Text).nodeValue = marker + currentValue + marker;
        }
            } else if (translatedChild.nodeType === Node.ELEMENT_NODE) {
                const nodeName = translatedChild.nodeName;

                if (nodeName.length < tagPrefix.length + 2 || 
                    nodeName.substring(0, tagPrefix.length) !== tagPrefix) {
                    logger.error(`Encountered an unexpected node in the returned translated HTML. Expected ${tagPrefix}${level}X but got ${nodeName}`);
                } else {
                    const prefixLen = tagPrefix.length;
                    const nodeLevel = parseInt(nodeName.substring(prefixLen, prefixLen + 1));
                    const nodeIndex = parseInt(nodeName.substring(prefixLen + 1));

                    if (nodeLevel !== level) {
                        logger.error(`Encountered a node at the wrong level. Expected level ${level} but got ${nodeName}`);
                    } else if (nodeIndex >= 0 && nodeIndex < srcElementNodes.length) {
                        targetNode = srcElementNodes[nodeIndex];
                        
                        if (!(targetNode as Element).hasAttribute('_isTranslated')) {
                            (targetNode as Element).setAttribute('_isTranslated', '1');
                        }

                        this.denormalizeElementRecursive(
                            targetNode as Element,
                            translatedChild as Element,
                            tagPrefix,
                            level + 1
                        );
                    } else {
                        logger.error(`Encountered a node at with an invalid element index. There are ${srcElementNodes.length} nodes at level ${level} but got ${nodeName}`);
                    }
                }
            }

            if (targetNode) {
                if (srcElement.childNodes[insertIndex] !== targetNode) {
                    if (targetNode.nodeType === Node.TEXT_NODE) {
                        const count = this.translateMutation.has(targetNode) 
                            ? this.translateMutation.get(targetNode)! + 1 
                            : 1;
                        this.translateMutation.set(targetNode, count);
                    }

                    srcElement.insertBefore(targetNode, srcElement.childNodes[insertIndex]);
                }

                insertIndex++;
            }
        }

        while (insertIndex < srcElement.childNodes.length) {
            srcElement.removeChild(srcElement.lastChild!);
        }
    }

    /**
     * Denormalize element
     */
    denormalizeElement(element: Element, translatedHtml: string, tagPrefix: string): void {
        if (!element || 
            !element.childNodes || 
            typeof translatedHtml !== 'string' || 
            translatedHtml.length === 0 || 
            typeof tagPrefix !== 'string' || 
            tagPrefix.length === 0) {
            return;
        }

        const upperTagPrefix = tagPrefix.toUpperCase();
        const tempDiv = document.createElement('div');
        
        tempDiv.innerHTML = translatedHtml.replace(TAG_REGEX.CUSTOM_TAG, '<$1$2$3>');

        this.denormalizeElementRecursive(element, tempDiv, upperTagPrefix, 1);
    }

    /**
     * Check for visible translation completion
     */
    checkForVisibleTranslationCompletion(request: TranslateRequest): void {
        if (this.bOnIntermediateCompleteCalled || this.bTranslateFullPageInOneGo) {
            return;
        }

        if (request.requestType === RequestType.ATTRIBUTE_REQUEST || this.isElementScrolled(request.element)) {
            this.iScrolledElementsTranslated++;
        } else if (this.iScrolledElementsTranslated > 0) {
            this.iHiddenElementsTranslated++;
        }

        if (this.iHiddenElementsTranslated > 0) {
            this.bOnIntermediateCompleteCalled = true;
            this._fVisibleComplete(false);
        }
    }

    /**
     * Check if element is scrolled
     */
    private isElementScrolled(element: Element): boolean {
        try {
            const node = element.nodeType === Node.ELEMENT_NODE ? element : element.parentElement;
            let rect: DOMRect | undefined;

            if (node && node.nodeType === Node.ELEMENT_NODE) {
                rect = node.getBoundingClientRect();
            }

            if (!rect) {
                return true;
            }

            if (rect.height === 0 || rect.width === 0) {
                (node as any)._tkScrolledData = true;
                (node as any)._tkScrolledTime = performance.now();
                return true;
            }

            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            return rect.top <= viewportHeight || rect.bottom <= viewportHeight;
        } catch (error) {
            return true;
        }
    }

    /**
     * Process translate request
     */
    processTranslateRequest(request: TranslateRequest): Promise<void> {
        return translateText(request.text).then(response => {
            if (this._bAborted) {
                return;
            }

            this.checkForVisibleTranslationCompletion(request);
            this._fTranslateDataCallBacks.incrementTotalCharacterTranslated(request.text.length);
            this.updateDetectedLanguage(response);

            if (this._oApplyStyle) {
                this.applyStyleToElement(
                    request.element,
                    this.bTranslateSelectedTextOnly,
                    this._oApplyStyle,
                    request.requestType === RequestType.ATTRIBUTE_REQUEST
                );
            }

            let translatedText = response.TranslatedText;

            if (response.RequiresUnmasking) {
                const numbers: string[] = [];
                extractNumbers(request.text, numbers);
                translatedText = unmaskNumbers(translatedText || '', numbers);
            }

            if (request.requestType === RequestType.ATTRIBUTE_REQUEST) {
                this.translateElementAttributes(
                    request.element,
                    request.attributeName!,
                    request.text,
                    translatedText
                );
            } else {
                this.translateElement(request.element, request.text, translatedText);
            }
        });
    }

    /**
     * Apply style to element
     */
    private applyStyleToElement(
        element: Element,
        isSelectionTranslation: boolean,
        style: ApplyStyle,
        isAttributeRequest: boolean
    ): void {
        try {
            if (isSelectionTranslation) {
                return;
            }

            let targetElement: any = element;

            if ('x-mst-element' in element) {
                targetElement = (element as any)['x-mst-element'];
                isAttributeRequest = true;
            }

            if (!style || !targetElement || !targetElement.getAttribute) {
                return;
            }

            const adjustAlign = targetElement.getAttribute('adjustalign');
            
            if (adjustAlign && adjustAlign.toLowerCase() === 'false') {
                targetElement.adjustAlign = false;
            } else if (targetElement.adjustAlign == null && targetElement.parentNode) {
                targetElement.adjustAlign = targetElement.parentNode.adjustAlign;
            }

            if (targetElement.adjustAlign == null) {
                targetElement.adjustAlign = true;
            }

            if (targetElement.style && 
                (isAttributeRequest || isNodeTranslatable(targetElement)) && 
                targetElement.adjustAlign) {
                while (!isAttributeRequest && getComputedStyleProperty(targetElement, 'display') === 'inline') {
                    targetElement = targetElement.parentNode;
                }

                for (const prop in style) {
                    if (prop in style) {
                        try {
                            const currentValue = getComputedStyleProperty(targetElement, prop);

                            if (currentValue === (style as any)[prop]) {
                                continue;
                            }

                            if (prop === 'textAlign') {
                                if ((currentValue && currentValue.toLowerCase().indexOf('center') !== -1) ||
                                    (targetElement.tagName && targetElement.tagName.toLowerCase() === 'center')) {
                                    continue;
                                }
                            }

                            if (!targetElement._tkStyle) {
                                targetElement._tkStyle = {};
                            }

                            if (targetElement.style && targetElement.style[prop]) {
                                targetElement._tkStyle[prop] = targetElement.style[prop];
                            } else {
                                targetElement._tkStyle[prop] = currentValue;
                            }

                            if (targetElement.style) {
                                targetElement.style[prop] = (style as any)[prop];
                            }
                        } catch (error) {
                            logger.error(error);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(error);
        }
    }

    /**
     * Translate
     */
    translate(stack: TraversalStack, triggerType: TriggerType): void {
        const getNextRequest = (): TranslateRequest | null => {
            const chunk = this.visibleElementChunks.getNextElementChunk();
            
            if (!chunk) {
                return null;
            }

            if (chunk.elementText) {
                return {
                    element: chunk.element,
                    requestType: RequestType.ELEMENT_REQUEST,
                    text: chunk.elementText
                };
            }

            const attrName = chunk.getNextAttribute();
            
            if (attrName) {
                return {
                    element: chunk.element,
                    requestType: RequestType.ATTRIBUTE_REQUEST,
                    text: chunk.getAttribute(attrName)!,
                    attributeName: attrName
                };
            }

            return null;
        };

        let request = getNextRequest();
        let requestBytes = getStringBytes(request?.text || null);

        do {
            if (!request) {
                break;
            }

            this._iVisibleTxtLength -= requestBytes;

            const chunk = this.visibleElementChunks.getElementChunk(request.element);

            if (chunk) {
                if (request.requestType === RequestType.ATTRIBUTE_REQUEST) {
                    chunk.removeNextAttribute();
                } else if (request.requestType === RequestType.ELEMENT_REQUEST) {
                    chunk.removeElementText();
                }

                if (chunk.isEmpty()) {
                    this.visibleElementChunks.removeElementChunk(request.element);
                }
            }

            this.processTranslateRequest(request);

            request = getNextRequest();
            requestBytes = getStringBytes(request?.text || null);
        } while (request && getPendingTextBytes() + requestBytes < MAX_CHUNK_SIZE && getPendingTextItems().length < 100);

        batchTranslate()
            .then(() => {
                logger.debug('Batch translation completed successfully');
                this.onNetworkRequestCompletion(stack, triggerType);
            })
            .catch((error) => {
                logger.error('Batch translation failed in translate():', error);
                this.onNetworkRequestFailure(error);
            });

        const queueCount = getQueueJobCount();
        logger.debug('Current queue job count:', queueCount);
        
        if (queueCount === 0) {
            logger.debug('Queue is empty, continuing DOM traversal');
            deferExecution(this.traverseDOM, stack, triggerType);
        }
    }

    /**
     * Update detected language
     */
    updateDetectedLanguage(response: any): void {
        const detectedLang = response.From;

        if (detectedLang == null || detectedLang.isBlank()) {
            return;
        }

        this._allDetectedLanguages[detectedLang] = (this._allDetectedLanguages[detectedLang] || 0) + 1;

        if (this._detectedLanguage == null || 
            this._detectedLanguage.isBlank() || 
            this._allDetectedLanguages[detectedLang] > this._allDetectedLanguages[this._detectedLanguage]) {
            this._detectedLanguage = detectedLang;
        }
    }

    /**
     * Handle network request completion
     */
    onNetworkRequestCompletion(stack: TraversalStack, triggerType: TriggerType): void {
        if (this._bAborted) {
            return;
        }

        translationState.requestsInitiated = true;
        deferExecution(this.traverseDOM, stack, triggerType);
    }

    /**
     * Handle network request failure
     */
    onNetworkRequestFailure(error: any): void {
        try {
            logger.error('Network request failure:', error);
            logger.error('Error details:', {
                message: error?.message || 'Unknown error',
                stack: error?.stack,
                aborted: this._bAborted,
                translationError: this.bSentTranslationError
            });

            translationState.requestsInitiated = true;

            if (this.bSentTranslationError || this._bAborted) {
                logger.debug('Error already sent or translation aborted, skipping error handling');
                return;
            }

            if (this._fError) {
                this._fError(error);
            }

            this.bSentTranslationError = true;
        } catch (e) {
            logger.error('Error in translateError. ', e);
        }

        if (!this.bSentTranslationComplete && !this.bOnIntermediateCompleteCalled) {
            logger.debug('Cancelling translation due to error');
            this.cancel();
        }
    }

    /**
     * Translate element attributes
     */
    translateElementAttributes(element: Element, attributeName: string, srcText: string, translatedText: string): void {
        if (srcText === translatedText) {
            return;
        }

        if ((element as any)._tkSrcAttribute === undefined) {
            (element as any)._tkSrcAttribute = {};
        }

        (element as any)._tkSrcAttribute[attributeName] = element.getAttribute(attributeName);

        if (this.attributeMutation.has(element)) {
            const attrs = this.attributeMutation.get(element)!;
            if (attributeName in attrs) {
                attrs[attributeName] += 1;
            } else {
                attrs[attributeName] = 1;
            }
        } else {
            this.attributeMutation.set(element, { [attributeName]: 1 });
        }

        const mstAttrName = '_tk' + attributeName;

        if (!srcText.isBlank()) {
            this.setElementAttributeInternal(element, mstAttrName, calculateTextHash(srcText));
        }

        const cleanedText = translatedText
            .replace(TAG_REGEX.HTML_TAG, '')
            .replace(HTML_ENTITY_REGEX.GT_ENTITY, '>')
            .replace(HTML_ENTITY_REGEX.LT_ENTITY, '<')
            .replace(HTML_ENTITY_REGEX.AMP_ENTITY, '&');

        this.setElementAttributeInternal(element, attributeName, cleanedText);
    }

    /**
     * Set element attribute (internal method)
     */
    private setElementAttributeInternal(element: Element, attributeName: string, value: string): void {
        switch (attributeName) {
            case 'aria-label':
            case 'value':
            case 'alt':
            case 'placeholder':
            case 'label':
            case '_tkvalue':
            case '_tkalt':
            case '_tkplaceholder':
            case '_tkaria-label':
            case '_tklabel':
                element.setAttribute(attributeName, value);
                break;
        }
    }

    /**
     * Translate element
     */
    translateElement(element: Element, srcText: string, translatedText: string): void {
        if (srcText === translatedText) {
            return;
        }

        (element as any)._tkSrcHtml = element.cloneNode(true);

        if (element.nodeName.toLowerCase() !== 'option') {
            try {
                this.denormalizeElement(element, translatedText, 'b');

                const textContent = element.textContent;
                if (textContent && !textContent.isBlank()) {
                    element.setAttribute('_tkTextHash', calculateTextHash(textContent || null));
                }
            } catch (error) {
                // Ignore errors
            }
        } else {
            this.denormalizeElement(element, translatedText, 'b');
        }
    }

    /**
     * Traverse DOM recursively
     */
    traverseDOMRecursive = (stack: TraversalStack, triggerType: TriggerType, terminalNodes: Node[]): void => {
        const domStack = stack.domStack;
        const properties = stack.properties;
        const offsetFromStart = stack.offsetFromStart;
        const hidden = stack.hidden;
        const elements = stack.elements;

        const flushSingleNode = (node: Node) => {
            recordElementState(this.flushChunk([node], true), hidden, elements);
        };

        let iterations = 0;

        while (iterations < this._maxTraversalIterations && 
               domStack.length > 0 && 
               (this._iVisibleTxtLength < MAX_VISIBLE_TEXT_LENGTH || terminalNodes.length)) {
            const currentNode = domStack.top!;

            if ((currentNode as any).shadowRoot) {
                this.traverseDOM(this.getTraversalStack((currentNode as any).shadowRoot), triggerType);
            }

            const isTranslatable = isNodeTranslatable(currentNode);

            if (!isTranslatable || (getTranslateMode(currentNode as Element) === TranslateMode.Off)) {
                if (!isTranslatable) {
                    addToSkipSet(currentNode);
                }
            }

            if (isIframeAccessible(currentNode as HTMLIFrameElement) && isTranslatable) {
                const iframe = currentNode as HTMLIFrameElement;
                domStack.push(iframe.contentWindow!.document.body);
                properties.push({ isRoot: false, traverseTerminalOnly: properties.top!.traverseTerminalOnly });
                offsetFromStart.push(0);
                this.flush(terminalNodes, hidden, elements);
                hidden.push(0);
                elements.push(0);
            } else if (!currentNode.firstChild || 
                       (!properties.top!.isRoot && properties.top!.traverseTerminalOnly) ||
                       isInlineNode(currentNode) || 
                       !isTranslatable) {
        while (domStack.length && 
               domStack.top && 
               properties.top && 
               properties.top!.isRoot !== true && 
               !domStack.top.nextSibling &&
               (domStack.top.nodeType !== Node.ELEMENT_NODE || !(domStack.top as Element).nextElementSibling)) {
                    domStack.pop();
                    properties.pop();
                    offsetFromStart.pop();
                    this.flush(terminalNodes, hidden, elements);
                    mergeStackState(domStack, hidden, elements);
                }

                if (properties.top && properties.top.isRoot === false) {
                    const poppedNode = domStack.pop();
                    const nextSibling = poppedNode!.nextSibling;
                    domStack.push(nextSibling!);

                    if (domStack.top && isInlineNode(domStack.top)) {
                        this.traverseElementRecursive(domStack.top as Element, flushSingleNode);
                    } else if (domStack.top) {
                        flushSingleNode(domStack.top);
                    }
                } else {
                    domStack.pop();
                    properties.pop();
                    offsetFromStart.pop();
                    this.flush(terminalNodes, hidden, elements);
                    mergeStackState(domStack, hidden, elements);
                }
            } else {
                const firstChild = currentNode.firstChild;
                if (firstChild) {
                    domStack.push(firstChild);
                    properties.push({ isRoot: false, traverseTerminalOnly: properties.top?.traverseTerminalOnly || false });
                    offsetFromStart.push(0);
                    this.flush(terminalNodes, hidden, elements);
                    hidden.push(0);
                    elements.push(0);

                    if (domStack.top && isInlineNode(domStack.top)) {
                        this.traverseElementRecursive(domStack.top as Element, flushSingleNode);
                    } else if (domStack.top) {
                        flushSingleNode(domStack.top);
                    }
                }
            }

            if (domStack.length) {
                const nodeName = (domStack.top!.nodeName || '').toLowerCase();

                if (isInlineNode(domStack.top!) && 
                    !ALWAYS_SKIP_TAGS.has(nodeName) && 
                    nodeName !== 'iframe' && 
                    nodeName !== 'frame') {
                    ++offsetFromStart.items[offsetFromStart.length - 1];
                    terminalNodes.push(domStack.top!);
                }
            }

            if (terminalNodes.length === 0 && 
                !domStack.isEmpty() && 
                hasIframeDocument(domStack.top)) {
                if (this._bScrollingStopped) {
                    break;
                }

                window.requestAnimationFrame(() => {
                    deferExecution(this.traverseDOMRecursive, stack, triggerType, terminalNodes);
                });

                return;
            }

            iterations++;
        }

        if (iterations !== this._maxTraversalIterations) {
            if (this.isTranslationPaused()) {
                this.migrateOutsideChunksToVisible();
            } else {
                this.migrateOutsideChunksToVisible();
            }

            if (this.visibleElementChunks.size > 0 || 
                this._bTxtChunksFlushed || 
                this._bScrollingStopped) {
                this._bTxtChunksFlushed = false;
                this._bScrollingStopped = false;
                this.translate(stack, triggerType);
            } else {
                this.bAutoTraversalCompleted = this.bAutoTraversalCompleted || 
                                               (triggerType === TriggerType.Auto && domStack.length === 0);

                if (getQueueJobCount() > 0) {
                    return;
                }

                this.isTraverseDOMActive = false;

                if (this.bAutoTraversalCompleted) {
                    this.translationComplete();
                }
            }
        } else {
            this.traverseDOMRecursive(stack, triggerType, terminalNodes);
        }
    };

    /**
     * Traverse element recursively
     */
    private traverseElementRecursive(element: Element, callback: (element: Element) => void, depth: number = 1): void {
        if (depth > 9) {
            return;
        }

        const childNodes = Array.from(element.childNodes);
        for (const child of childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                callback(child as Element);
                this.traverseElementRecursive(child as Element, callback, depth + 1);
            }
        }
    }

    /**
     * Traverse DOM
     */
    traverseDOM = (stack: TraversalStack, triggerType: TriggerType): void => {
        try {
            const terminalNodes: Node[] = [];

            if (this._eDomRoot && 
                isInlineNode(this._eDomRoot) && 
                !this.bFlushedStartTerminalNode) {
                this.bFlushedStartTerminalNode = true;
                this.flushChunk([this._eDomRoot]);
            }

            deferExecution(this.traverseDOMRecursive, stack, triggerType, terminalNodes);
        } catch (error) {
            logger.error('Unknown error in traverseDom.', error);
        }
    };

    /**
     * Execute translation
     */
    executeTranslation(): PageTranslator {
        if (this._eDomRoot?.nodeType !== Node.ELEMENT_NODE) {
            throw new Error('Invalid input type');
        }

        const documentTranslateMode = getTranslateMode(document.documentElement);

        if (this._sFrom === this._sTo || 
            !this._eDomRoot.hasChildNodes() || 
            documentTranslateMode === TranslateMode.Off) {
            this.translationComplete();
            return this;
        }

        setTranslatorInstance(this);

        if (!this.bTranslateSelectedTextOnly && !this.bTranslateFullPageInOneGo) {
            registerScrollStopDetection(() => {
                if (getQueueJobCount() === 0) {
                    this.triggerTraverseDom(TriggerType.Scrolled);
                }
            });
        }

        this.setMutationObserversForDocument(window);

        registerVisibilityListener(document, () => this.onDocumentVisibilityChange());

        if (!this.bTranslateSelectedTextOnly) {
            const titleElement = document.querySelector('head > title');
            if (titleElement) {
                this.flushChunk([titleElement]);
            }
        }

        this.isTraverseDOMActive = true;
        this.traverseDOM(this.getTraversalStack(this._eDomRoot), TriggerType.Auto);

        return this;
    }
}

/**
 * Get pending text items from TranslateTextItem array
 */
function getPendingTextItems(): any[] {
    return require('./translation-cache').getPendingTextItems();
}

/**
 * Get pending text bytes
 */
function getPendingTextBytes(): number {
    return require('./translation-cache').getPendingTextBytes();
}

