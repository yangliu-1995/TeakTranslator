/**
 * String prototype extensions
 */

declare global {
    interface String {
        isBlank(): boolean;
        htmlEscape(): string;
    }
}

/**
 * Check if string is blank
 */
String.prototype.isBlank = String.prototype.isBlank || function(this: string): boolean {
    return this == null || typeof this !== 'string' || this.trim().length === 0;
};

/**
 * HTML escape
 */
String.prototype.htmlEscape = String.prototype.htmlEscape || function(this: string): string {
    if (!this) return '';
    
    const span = document.createElement('span');
    span.innerText = this;
    return span.innerHTML;
};

export {};
