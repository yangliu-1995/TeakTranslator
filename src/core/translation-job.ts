import { TranslateResponse } from '../types/interfaces';

/**
 * Translation job class
 */
export class TranslationJob {
    private _sFrom: string;
    private _sTo: string;
    private _aTextArray: string[];
    private _oJobData: any;
    private _fOnSuccess: ((jobData: any, result: TranslateResponse[]) => void) | null;
    private _fOnError: ((jobData: any, error: any) => void) | null;
    private _bBuffered: boolean;

    constructor(
        fromLang: string,
        toLang: string,
        textArray: string[],
        jobData: any,
        onSuccess: ((jobData: any, result: TranslateResponse[]) => void) | null,
        onError: ((jobData: any, error: any) => void) | null,
        isBuffered: boolean = false
    ) {
        this._sFrom = fromLang;
        this._sTo = toLang;
        this._aTextArray = textArray;
        this._oJobData = jobData;
        this._fOnSuccess = onSuccess;
        this._fOnError = onError;
        this._bBuffered = isBuffered;
    }

    /**
     * Check if is buffered request
     */
    isBufferedRequest(): boolean {
        return this._bBuffered;
    }

    /**
     * Success callback
     */
    onSuccess(result: TranslateResponse[]): void {
        if (this._fOnSuccess) {
            this._fOnSuccess(this._oJobData, result);
        }
    }

    /**
     * Error callback
     */
    onError(error: any): void {
        if (this._fOnError) {
            this._fOnError(this._oJobData, error);
        }
    }

    /**
     * Get source language
     */
    get fromLang(): string {
        return this._sFrom;
    }

    /**
     * Get target language
     */
    get toLang(): string {
        return this._sTo;
    }

    /**
     * Get text array
     */
    get textArray(): string[] {
        return this._aTextArray;
    }
}
