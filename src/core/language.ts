/**
 * RTL language mapping
 */
const RTL_LANGUAGES: Record<string, boolean> = {
    ar: true,
    fa: true,
    he: true,
    ku: true,
    ps: true,
    ur: true
};

/**
 * Language class
 */
export class Language {
    public code: string;
    public name: string;

    constructor(code: string, name: string) {
        this.name = name;
        this.code = Language.normalizeCode(code);
    }

    toString(): string {
        return `${this.code}: ${this.name}`;
    }

    /**
     * Check if language is RTL
     */
    static isRtl(code: string): boolean {
        return Language.normalizeCode(code).toLowerCase() in RTL_LANGUAGES;
    }

    /**
     * Compare if two languages are equal
     */
    static equals(lang1: Language | null, lang2: Language | null): boolean {
        return lang1 != null && lang2 != null && lang1.code === lang2.code;
    }

    /**
     * Normalize language code
     */
    static normalizeCode(code: string): string {
        let primary = '';
        let region = '';
        let script = '';
        
        const parts = code.split('-');
        primary = parts[0].toLowerCase();
        
        for (let i = 1; i < parts.length && !script && !region; i++) {
            if (parts[i].length === 2) {
                region = parts[i].toUpperCase();
                if (primary === 'zh' && region === 'CN') {
                    script = 'Hans';
                } else if (primary === 'zh' && region === 'TW') {
                    script = 'Hant';
                }
            } else if (parts[i].length === 3 && !region) {
                if (parts[i].toUpperCase() === 'CHS') {
                    script = 'Hans';
                } else if (parts[i] === 'CHT') {
                    script = 'Hant';
                }
            } else if (parts[i].length === 4 && !region) {
                script = parts[i][0].toUpperCase() + parts[i].substring(1).toLowerCase();
            }
        }
        
        if (primary === 'nb') {
            primary = 'no';
        } else if (primary === 'und') {
            primary = '';
        }
        
        let result = primary;
        if (script) {
            result += '-' + script;
        }
        
        return result;
    }
}
