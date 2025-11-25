import { LogLevel } from '../types/enums';

/**
 * Logging configuration
 */
export const logConfig = {
    logLevel: LogLevel.Error,
    debug: false
};

/**
 * Logger utility class
 */
export const logger = {
    info(...args: any[]) {
        if (logConfig.logLevel & LogLevel.Info) {
            console.info(...args);
        }
    },

    warning(...args: any[]) {
        if (logConfig.logLevel & LogLevel.Warning) {
            console.warn(...args);
        }
    },

    error(...args: any[]) {
        if (logConfig.logLevel & LogLevel.Error) {
            console.error(...args);
        }
    },

    assert(condition: boolean, ...args: any[]) {
        if (logConfig.logLevel & LogLevel.Debug) {
            args.unshift(condition);
            console.assert(condition, ...args);
        }
    },

    debug(...args: any[]) {
        if (logConfig.logLevel & LogLevel.Debug) {
            console.debug(...args);
        }
    }
};
