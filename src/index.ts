/**
 * Teak Translator - Main entry file
 */

import './core/string-extensions';
import { TranslateAPI } from './api/translate-api';
import { 
    setTranslatorApi, 
    getTranslatorApi, 
    IOSNativeTranslator, 
    MockTranslator 
} from './core/translator-api';
import { BaseTranslator } from './core/base-translator';

/**
 * Translator interface
 */
export interface Translator {
    startPageTranslation: (
        fromLang: string,
        toLang: string,
        translateFullPageInOneGo: boolean,
        onIntermediateComplete: (() => void) | null,
        translateDataCallbacks: {
            onTranslateApiCalled: () => void;
            incrementTotalCharacterTranslated: (count: number) => void;
        },
        onError: (error: string) => void
    ) => void;
    startSelectionTranslation: (
        toLang: string,
        onIntermediateComplete: () => void,
        translateDataCallbacks: {
            onTranslateApiCalled: () => void;
            incrementTotalCharacterTranslated: (count: number) => void;
        },
        onError: (error: string) => void
    ) => Promise<any>;
    stopPageTranslation: () => Promise<void>;
    setTranslatorApi: (translator: BaseTranslator) => void;
    getTranslatorApi: () => BaseTranslator;
    IOSNativeTranslator: typeof IOSNativeTranslator;
    MockTranslator: typeof MockTranslator;
}

/**
 * Export Translator object
 */
const translator: Translator = {
    startPageTranslation: TranslateAPI.startPageTranslation,
    startSelectionTranslation: TranslateAPI.startSelectionTranslation,
    stopPageTranslation: TranslateAPI.stopPageTranslation,
    setTranslatorApi: setTranslatorApi,
    getTranslatorApi: getTranslatorApi,
    IOSNativeTranslator: IOSNativeTranslator,
    MockTranslator: MockTranslator
};

export default { Translator: translator };
