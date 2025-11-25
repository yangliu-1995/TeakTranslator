/**
 * Log level enumeration
 */
export enum LogLevel {
    Off = 0,
    Error = 1,
    Warning = 2,
    Info = 4,
    Debug = 8,
    Assert = 16,
    All = 4294967295
}

/**
 * Translation mode enumeration
 */
export enum TranslateMode {
    Inherit = 0,
    On = 1,
    Off = 2
}

/**
 * Trigger type enumeration
 */
export enum TriggerType {
    Auto = 0,
    Scrolled = 1,
    Mutation = 2,
    VisibilityChange = 3
}

/**
 * Visibility state enumeration
 */
export const VisibilityState = Object.freeze({
    outsideView: 1,
    insideView: 2,
    hidden: 4,
    unknown: 64
});

/**
 * Request type enumeration
 */
export enum RequestType {
    ELEMENT_REQUEST = 0,
    ATTRIBUTE_REQUEST = 1
}

/**
 * HTTP method enumeration
 */
export enum HttpMethod {
    GET = 0,
    POST = 1,
    HEAD = 2,
    PUT = 3,
    DELETE = 4
}
