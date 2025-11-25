import { TranslateResponse } from '../types/interfaces';

/**
 * Base translator class (abstract)
 */
export abstract class BaseTranslator {
    protected fromLanguage: string = '';
    protected toLanguage: string = '';

    /**
     * Asynchronously translate text array
     * @param fromLang Source language
     * @param toLang Target language
     * @param textArray Array of texts to translate
     * @returns Array of translation results
     */
    abstract translateAsync(
        fromLang: string,
        toLang: string,
        textArray: string[]
    ): Promise<TranslateResponse[]>;

    /**
     * Get source language
     */
    getFromLanguage(): string {
        return this.fromLanguage;
    }

    /**
     * Get target language
     */
    getToLanguage(): string {
        return this.toLanguage;
    }

    /**
     * Set source language
     */
    setFromLanguage(lang: string): void {
        this.fromLanguage = lang;
    }

    /**
     * Set target language
     */
    setToLanguage(lang: string): void {
        this.toLanguage = lang;
    }
}
