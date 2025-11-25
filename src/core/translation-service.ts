import { TranslateResponse, TranslateTextItem } from '../types/interfaces';
import { TranslationQueue } from './translation-queue';
import { TranslationJob } from './translation-job';
import { MAX_VISIBLE_TEXT_LENGTH, MAX_CHUNK_SIZE } from './constants';
import { logger } from '../utils/logger';
import { getStringBytes } from '../utils/helpers';
import { maskNumbers } from './dom-utils';
import {
    createPromiseResolver,
    getFromCache,
    getPendingTextItems,
    setPendingTextItems,
    getPendingTextBytes,
    setPendingTextBytes,
    addPromiseResolver,
    getPromiseResolver,
    rejectPendingTextItems,
    processTranslationResult
} from './translation-cache';

/**
 * Translation service singleton
 */
let currentTranslatorInstance: any = null;

/**
 * Translation queue instance
 */
const translationQueue = new TranslationQueue(4, MAX_VISIBLE_TEXT_LENGTH);

/**
 * Set current translator instance
 */
export function setTranslatorInstance(instance: any): void {
    currentTranslatorInstance = instance;
}

/**
 * Get current translator instance (PageTranslator instance)
 */
function getTranslatorInstance(): any {
    return currentTranslatorInstance;
}

/**
 * Get number of jobs in queue
 */
export function getQueueJobCount(): number {
    return translationQueue.numOfTotalJobsInQueue();
}

/**
 * Translate single text
 */
function translateSingleText(text: string): Promise<TranslateResponse> {
    const textBytes = getStringBytes(text);

    if (textBytes > MAX_CHUNK_SIZE) {
        return translateLargeText(text);
    }

    let maskedText = text;
    let requiresUnmasking = false;

    if (!/(?!\d)\p{Decimal_Number}/gu.test(text)) {
        const result = maskNumbers(text);
        maskedText = result.replacedStr;
        requiresUnmasking = result.hasChanged;
    }

    const cached = getFromCache(maskedText);
    if (cached) {
        return Promise.resolve(cached);
    }

    let promiseResolver = getPromiseResolver(maskedText);
    
    if (!promiseResolver) {
        const items = getPendingTextItems();
        items.push({
            originalText: text,
            maskedText: maskedText,
            requiresUnmasking: requiresUnmasking
        });
        setPendingTextItems(items);
        setPendingTextBytes(getPendingTextBytes() + textBytes);

        promiseResolver = createPromiseResolver<TranslateResponse>();
        addPromiseResolver(maskedText, promiseResolver);
    }

    return promiseResolver.promise;
}

/**
 * Translate large text
 */
function translateLargeText(text: string): Promise<TranslateResponse> {
    const translator = getTranslatorInstance();
    if (!translator) {
        logger.error('Translator instance is not set');
        return Promise.reject(new Error('Translator instance is not set'));
    }

    const resolver = createPromiseResolver<TranslateResponse>();

    const job = new TranslationJob(
        translator.getFromLanguage(),
        translator.getToLanguage(),
        [text],
        [text],
        (jobData: string[], results: TranslateResponse[]) => {
            if (jobData.length !== results.length) {
                logger.error('Invalid results from Translate Service', 'Expected:', jobData.length, 'Got:', results.length);
                resolver.reject(new Error('Invalid results from Translate Service'));
                return;
            }

            const result = results[0];
            result.RequiresUnmasking = false;
            resolver.resolve(result);
        },
        (jobData: any, error: any) => {
            logger.error('Translation failed:', error);
            resolver.reject(error);
        },
        true
    );

    translationQueue.addJob(job);
    return resolver.promise;
}

/**
 * Batch translate
 */
export function batchTranslate(): Promise<void> {
    const translator = getTranslatorInstance();
    if (!translator) {
        logger.error('Translator instance is not set');
        return Promise.reject(new Error('Translator instance is not set'));
    }

    const pendingItems = getPendingTextItems();
    if (pendingItems.length === 0) {
        return Promise.resolve();
    }

    const items = pendingItems;
    const totalBytes = getPendingTextBytes();

    setPendingTextItems([]);
    setPendingTextBytes(0);

    const resolver = createPromiseResolver<void>();

    const job = new TranslationJob(
        translator.getFromLanguage(),
        translator.getToLanguage(),
        items.map(item => item.originalText),
        items,
        (jobData: TranslateTextItem[], results: TranslateResponse[]) => {
            if (jobData.length !== results.length) {
                logger.error('Invalid results from Translate Service', 'Expected:', jobData.length, 'Got:', results.length);
                const errorMsg = 'Inconsistent Data: Expected ' + jobData.length + ' results, got ' + results.length;
                rejectPendingTextItems(jobData, errorMsg);
                resolver.reject(new Error(errorMsg));
                return;
            }

            for (let i = 0; i < jobData.length; i++) {
                processTranslationResult(jobData[i], results[i]);
            }

            resolver.resolve();
        },
        (jobData: TranslateTextItem[], error: any) => {
            logger.error('Batch translation failed:', error);
            rejectPendingTextItems(jobData, error);
            resolver.reject(error);
        },
        totalBytes > MAX_CHUNK_SIZE
    );

    translationQueue.addJob(job);
    return resolver.promise;
}

/**
 * Translate text (public interface)
 */
export function translateText(text: string): Promise<TranslateResponse> {
    return translateSingleText(text);
}

