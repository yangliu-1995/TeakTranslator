import { TranslationJob } from './translation-job';
import { translatorApi } from './translator-api';
import { logger } from '../utils/logger';
import { TranslateResponse } from '../types/interfaces';

/**
 * Translation queue management class
 */
export class TranslationQueue {
    private _iMaxParallelJobs: number;
    private _iMaxChunkSize: number;
    private _aJobs: TranslationJob[];
    private _iActiveJobs: number;
    private _iTotalTriggeredJobs: number;

    constructor(maxParallelJobs: number, maxChunkSize: number) {
        this._iMaxParallelJobs = maxParallelJobs;
        this._iMaxChunkSize = maxChunkSize;
        this._aJobs = [];
        this._iActiveJobs = 0;
        this._iTotalTriggeredJobs = 0;
    }

    /**
     * Purge queue
     */
    purgeQueue(): void {
        this._aJobs = [];
        logger.debug('Purging jobQueue. Having', this._iActiveJobs, 'active jobs currently.');
    }

    /**
     * Add job
     */
    addJob(job: TranslationJob): void {
        this._aJobs.push(job);
        logger.debug('Adding job to jobQueue. Active Jobs: ', this._iActiveJobs, ', Remaining Jobs: ', this._aJobs.length);
        this.startProcessing();
    }

    /**
     * Start processing queue
     */
    startProcessing(): void {
        if (this._aJobs.length > 0 && this._iActiveJobs < this._iMaxParallelJobs) {
            const job = this._aJobs.shift();
            
            if (!job) return;

            if (job.isBufferedRequest()) {
                this.processBufferedRequest(job);
                return;
            }

            translatorApi.translateAsync(job.fromLang, job.toLang, job.textArray)
                .then(
                    (result: TranslateResponse[]) => {
                        this._iActiveJobs -= 1;
                        job.onSuccess(result);
                        this.startProcessing();
                    },
                    (error: any) => {
                        this._iActiveJobs -= 1;
                        job.onError(error);
                        this.startProcessing();
                    }
                );

            this._iActiveJobs += 1;
            this._iTotalTriggeredJobs += 1;
            this.optimizeParallelRequestsAmount();
        }
    }

    /**
     * Process buffered request
     */
    processBufferedRequest(job: TranslationJob): void {
        const chunks = this.splitTextIntoChunks(job.textArray[0], this._iMaxChunkSize);
        const results: { [key: number]: TranslateResponse[] } = {};
        let hasError = false;

        chunks.forEach((chunk, index) => {
            const chunkJob = new TranslationJob(
                job.fromLang,
                job.toLang,
                [chunk],
                index,
                (jobIndex: number, chunkResults: TranslateResponse[]) => {
                    results[jobIndex] = chunkResults;

                    if (!hasError && Object.keys(results).length === chunks.length) {
                        const combined: TranslateResponse[] = [{
                            From: '',
                            TranslatedText: ''
                        }];

                        for (let i = 0; i < chunks.length; i++) {
                            const chunkResult = results[i][0];
                            combined[0].From = chunkResult.From;
                            combined[0].TranslatedText += chunkResult.TranslatedText;
                        }

                        job.onSuccess(combined);
                    }
                },
                (jobIndex: any, error: any) => {
                    hasError = true;
                    job.onError(error);
                    this.startProcessing();
                }
            );

            this.addJob(chunkJob);
        });
    }

    /**
     * Split text into chunks
     */
    private splitTextIntoChunks(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        
        while (text.length > chunkSize) {
            chunks.push(text.substr(0, chunkSize));
            text = text.substr(chunkSize);
        }

        if (text.length === 0 && chunks.length !== 0) {
            // Do not add empty string
        } else {
            chunks.push(text);
        }

        return chunks;
    }

    /**
     * Get total number of jobs in queue
     */
    numOfTotalJobsInQueue(): number {
        return this._aJobs.length + this._iActiveJobs;
    }

    /**
     * Optimize parallel request amount
     */
    optimizeParallelRequestsAmount(): void {
        if (this._iTotalTriggeredJobs > 33) {
            this._iMaxParallelJobs = 2;
        } else if (this._iMaxParallelJobs > 3 && this._iTotalTriggeredJobs % 10 === 0) {
            this._iMaxParallelJobs = this._iMaxParallelJobs - this._iMaxParallelJobs / 3;
        }
    }
}

