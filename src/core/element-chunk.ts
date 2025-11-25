import { getStringBytes, calculateTextHash, getElementHash } from '../utils/helpers';

/**
 * Element chunk class - Stores translation text and attributes for an element
 */
export class ElementChunk {
    public element: Element;
    private text: string | null;
    private attributes: Map<string, string>;
    public numBytes: number;

    constructor(element: Element) {
        this.element = element;
        this.text = null;
        this.attributes = new Map();
        this.numBytes = 0;
    }

    /**
     * Get all attribute names
     */
    getAllAttributes(): IterableIterator<string> {
        return this.attributes.keys();
    }

    /**
     * Get element text
     */
    get elementText(): string | null {
        return this.text;
    }

    /**
     * Set element text
     */
    set elementText(value: string | null) {
        this.numBytes -= getStringBytes(this.text);
        this.text = value;
        this.numBytes += getStringBytes(value);
    }

    /**
     * Add attribute
     */
    addAttribute(name: string, value: string): void {
        this.numBytes -= getStringBytes(this.getAttribute(name) || null);
        this.attributes.set(name, value);
        this.numBytes += getStringBytes(value);
    }

    /**
     * Remove attribute
     */
    removeAttribute(name: string): void {
        this.numBytes -= getStringBytes(this.getAttribute(name) || null);
        this.attributes.delete(name);
    }

    /**
     * Get attribute value
     */
    getAttribute(name: string): string | undefined {
        return this.attributes.get(name);
    }

    /**
     * Get byte count
     */
    getStringBytes(): number {
        return this.numBytes;
    }

    /**
     * Get next attribute name
     */
    getNextAttribute(): string | null {
        const iterator = this.getAllAttributes().next();
        return iterator.done ? null : iterator.value;
    }

    /**
     * Remove next attribute
     */
    removeNextAttribute(): void {
        const attr = this.getNextAttribute();
        if (attr) {
            this.removeAttribute(attr);
        }
    }

    /**
     * Check if empty
     */
    isEmpty(): boolean {
        return !this.text && this.attributes.size === 0;
    }

    /**
     * Remove element text
     */
    removeElementText(): void {
        this.numBytes -= getStringBytes(this.text);
        this.text = null;
    }
}

/**
 * Element chunk store class
 */
export class ElementChunkStore {
    private elementChunkMap: Map<string, ElementChunk>;

    constructor() {
        this.elementChunkMap = new Map();
    }

    /**
     * Ensure element chunk exists
     */
    ensureElementChunk(element: Element): ElementChunk {
        let hash = getElementHash(element);
        
        if (hash == null) {
            hash = (globalChunkCounter++).toString();
            element.setAttribute('_tkHash', hash);
        }

        let chunk = this.elementChunkMap.get(hash);
        
        if (chunk == null) {
            chunk = new ElementChunk(element);
            this.elementChunkMap.set(hash, chunk);
        }

        return chunk;
    }

    /**
     * Add element text
     */
    addElementText(element: Element, text: string): void {
        this.ensureElementChunk(element).elementText = text;
    }

    /**
     * Add element attribute
     */
    addElementAttributes(element: Element, name: string, value: string): void {
        this.ensureElementChunk(element).addAttribute(name, value);
    }

    /**
     * Remove element chunk
     */
    removeElementChunk(element: Element): void {
        const hash = getElementHash(element);
        if (hash) {
            this.elementChunkMap.delete(hash);
        }
    }

    /**
     * Get element chunk
     */
    getElementChunk(element: Element): ElementChunk | undefined {
        const hash = getElementHash(element);
        return hash ? this.elementChunkMap.get(hash) : undefined;
    }

    /**
     * Get next element chunk
     */
    getNextElementChunk(): ElementChunk | null {
        const iterator = this.getAllElementChunks().next();
        return iterator.done ? null : iterator.value;
    }

    /**
     * Get all element chunks
     */
    getAllElementChunks(): IterableIterator<ElementChunk> {
        return this.elementChunkMap.values();
    }

    /**
     * Get store size
     */
    get size(): number {
        return this.elementChunkMap.size;
    }
}

/**
 * Global chunk counter
 */
let globalChunkCounter = 0;

