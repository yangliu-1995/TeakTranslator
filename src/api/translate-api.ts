import { PageTranslator, setTranslatorInstance } from '../core/page-translator';
import { translateSelection } from '../core/selection-translator';
import { TranslateDataCallbacks } from '../types/interfaces';
import { logger } from '../utils/logger';
import { translationState } from '../utils/state';
import { untranslateElement, untranslateTitleElement } from '../core/untranslate';
import { clearPromiseResolvers, setPendingTextItems, setPendingTextBytes } from '../core/translation-cache';

/**
 * Global translator instance
 */
let globalTranslatorInstance: PageTranslator | null = null;

/**
 * Global translation timeout timer
 */
let translationTimeoutId: number | null = null;

/**
 * Stop page translation
 */
function stopPageTranslation(): Promise<void> {
    if (globalTranslatorInstance == null) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        globalTranslatorInstance?.cancel();
        setTranslatorInstance(null);
        globalTranslatorInstance = null;
        logger.info('Successfully completed untranslation.');
        resolve();
    });
}

/**
 * Start page translation
 */
export function startPageTranslation(
    fromLang: string,
    toLang: string,
    translateFullPageInOneGo: boolean,
    onIntermediateComplete: (() => void) | null,
    translateDataCallbacks: TranslateDataCallbacks,
    onError: (error: string) => void
): void {
    function clearTranslationTimeout(): void {
        if (translationTimeoutId) {
            clearTimeout(translationTimeoutId);
        }
    }

    function handleTranslationError(error: any): void {
        clearTranslationTimeout();
        stopPageTranslation().then(() => {
            onError(error);
        });
    }

    if (translationTimeoutId) {
        clearTimeout(translationTimeoutId);
    }

    if (!translateFullPageInOneGo) {
        translationTimeoutId = window.setTimeout(() => {
            logger.error('20000ms completed now. Translation timed out.');
            handleTranslationError(JSON.stringify({ status: -2 }));
        }, 20000);
    }

    logger.info('Beginning page translation...');

    stopPageTranslation().then(() => {
        performPageTranslation(
            fromLang,
            toLang,
            translateFullPageInOneGo,
            () => {
                clearTranslationTimeout();
                if (onIntermediateComplete) {
                    onIntermediateComplete();
                }
            },
            translateDataCallbacks,
            (error: any) => {
                clearTranslationTimeout();
                onError(error);
            }
        );
    }).catch((error) => {
        logger.error('Failed to translate page.');
        handleTranslationError(error);
    });
}

/**
 * Perform page translation
 */
function performPageTranslation(
    fromLang: string,
    toLang: string,
    translateFullPageInOneGo: boolean,
    onIntermediateComplete: () => void,
    translateDataCallbacks: TranslateDataCallbacks,
    onError: (error: any) => void
): Promise<void> {
    const handleIntermediateComplete = (isComplete: boolean) => {
        logger.debug('Intermidiate complete called with ' + isComplete);
        if (onIntermediateComplete) {
            onIntermediateComplete();
        }
    };

    const handleError = (error: string) => {
        logger.error('Error occurred while translating. Details: ' + error);
        setTranslatorInstance(null);
        globalTranslatorInstance = null;
        if (onError) {
            onError(error);
        }
    };

    translationState.translationStartTime = performance.now();

    return new Promise<void>((resolve) => {
        globalTranslatorInstance = new PageTranslator(
            document.body,
            fromLang,
            toLang,
            resolve,
            handleError,
            handleIntermediateComplete,
            false,
            translateFullPageInOneGo,
            translateDataCallbacks
        );

        setTranslatorInstance(globalTranslatorInstance);
        globalTranslatorInstance.executeTranslation();
    }).then(() => {
        logger.info('Successfully completed translation.');
    }).catch((error) => {
        logger.error('Failed to translate the page', error);
        if (onError) {
            onError(error);
        }
    });
}

/**
 * Start selection translation
 */
export function startSelectionTranslation(
    toLang: string,
    onIntermediateComplete: () => void,
    translateDataCallbacks: TranslateDataCallbacks,
    onError: (error: string) => void
): Promise<any> {
    return translateSelection(toLang, onIntermediateComplete, translateDataCallbacks, onError);
}

/**
 * Export API
 */
export const TranslateAPI = {
    startPageTranslation,
    startSelectionTranslation,
    stopPageTranslation
};
