import { TranslateResponse } from '../types/interfaces';
import { BaseTranslator } from './base-translator';

/**
 * Translation API response interface
 */
interface IOSTranslateResponse {
    translatedText: string;
    from: string;
}

/**
 * iOS native translation API class
 */
export class IOSNativeTranslator extends BaseTranslator {
    /**
     * Asynchronously translate text array
     */
    async translateAsync(
        fromLang: string,
        toLang: string,
        textArray: string[]
    ): Promise<TranslateResponse[]> {
        return new Promise((resolve) => {
            (window as any).webkit.messageHandlers.translator
                .postMessage({
                    command: 'IOSNativeRequest',
                    fromLang: fromLang,
                    toLang: toLang,
                    textArray: textArray
                })
                .then((responses: IOSTranslateResponse[]) => {
                    const results = responses.map(response => ({
                        TranslatedText: response.translatedText,
                        From: response.from
                    }));
                    resolve(results);
                });
        });
    }
}

/**
 * Mock translator class (for testing)
 */
export class MockTranslator extends BaseTranslator {
    /**
     * Asynchronously translate text array
     */
    async translateAsync(
        fromLang: string,
        toLang: string,
        textArray: string[]
    ): Promise<TranslateResponse[]> {
        this.setFromLanguage(fromLang);
        this.setToLanguage(toLang);
        
        return new Promise((resolve) => {
            // Simulate network delay
            setTimeout(() => {
                const results = textArray.map(text => ({
                    TranslatedText: `[traslated]${text}[/traslated]`,
                    From: fromLang || 'en'
                }));
                resolve(results);
            }, 100);
        });
    }
}

/**
 * Translator API instance (defaults to IOSNativeTranslator)
 */
let translatorApi: BaseTranslator = new IOSNativeTranslator();

/**
 * Set translator instance (for testing or switching translators)
 */
export function setTranslatorApi(translator: BaseTranslator): void {
    translatorApi = translator;
}

/**
 * Get current translator instance
 */
export function getTranslatorApi(): BaseTranslator {
    return translatorApi;
}

export { translatorApi };
