import { Stack } from '../types/interfaces';

/**
 * Generic stack data structure implementation
 */
export class GenericStack<T> implements Stack<T> {
    public items: T[];

    constructor(initialItems: T[] = []) {
        this.items = [...initialItems];
    }

    get first(): T | undefined {
        return this.length === 0 ? undefined : this.items[0];
    }

    get top(): T | undefined {
        return this.length === 0 ? undefined : this.items[this.length - 1];
    }

    set top(value: T) {
        if (this.length > 0) {
            this.items[this.length - 1] = value;
        }
    }

    get length(): number {
        return this.items.length;
    }

    pop = (): T | undefined => this.items.pop();

    shift = (): T | undefined => this.items.shift();

    push = (item: T): number => this.items.push(item);

    *[Symbol.iterator](): Iterator<T> {
        for (const item of this.items) {
            yield item;
        }
    }

    get(index: number): T | undefined {
        return this.length <= index ? undefined : this.items[index];
    }

    clear(): void {
        this.items.length = 0;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }
}

/**
 * Array stack (extends Array and adds top property)
 */
export class ArrayStack<T> extends Array<T> {
    get top(): T {
        return this[this.length - 1];
    }

    set top(value: T) {
        this[this.length - 1] = value;
    }
}
