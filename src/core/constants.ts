import { freezeMap, freezeObject } from '../utils/helpers';
import { TranslateMode } from '../types/enums';

/**
 * Tags to always skip
 */
export const ALWAYS_SKIP_TAGS = freezeMap<string, number>({
    head: 1,
    script: 1,
    style: 1,
    code: 1,
    samp: 1,
    var: 1,
    kbd: 1,
    pre: 1,
    object: 1,
    address: 1,
    noscript: 1,
    embed: 1,
    map: 1
});

/**
 * Textarea tags
 */
export const TEXTAREA_TAGS = freezeMap<string, number>({
    textarea: 1
});

/**
 * Terminal node tags
 */
export const TERMINAL_TAGS = Object.assign(
    freezeMap<string, number>({
        hr: 1,
        input: 1,
        title: 1,
        br: 1,
        frame: 1,
        iframe: 1,
        textarea: 1
    }),
    ALWAYS_SKIP_TAGS
);

/**
 * Predicate that always returns true
 */
const alwaysTrue = () => true;

/**
 * Attribute translation configuration
 */
interface AttributeConfig {
    predicate: (element?: Element) => boolean;
    attributes: string[];
}

/**
 * Translatable attributes mapping
 */
export const TRANSLATABLE_ATTRIBUTES = freezeMap<string, AttributeConfig[]>({
    INPUT: [
        {
            predicate: (e?: Element) => ['button', 'submit', 'reset'].includes((e as HTMLInputElement)?.type),
            attributes: ['value']
        },
        {
            predicate: (e?: Element) => ['image'].includes((e as HTMLInputElement)?.type),
            attributes: ['alt']
        },
        {
            predicate: alwaysTrue,
            attributes: ['placeholder']
        }
    ],
    TEXTAREA: [
        {
            predicate: alwaysTrue,
            attributes: ['placeholder']
        }
    ],
    IMG: [
        {
            predicate: alwaysTrue,
            attributes: ['alt']
        }
    ],
    AREA: [
        {
            predicate: alwaysTrue,
            attributes: ['alt']
        }
    ],
    OPTION: [
        {
            predicate: alwaysTrue,
            attributes: ['label']
        }
    ],
    OPTGROUP: [
        {
            predicate: alwaysTrue,
            attributes: ['label']
        }
    ],
    TRACK: [
        {
            predicate: alwaysTrue,
            attributes: ['label']
        }
    ]
});

/**
 * Translate attribute values mapping
 */
export const TRANSLATE_ATTRIBUTE_VALUES = freezeMap<string, TranslateMode>({
    true: TranslateMode.On,
    yes: TranslateMode.On,
    false: TranslateMode.Off,
    no: TranslateMode.Off,
    skip: TranslateMode.Off
});

/**
 * Translate attributes mapping
 */
export const TRANSLATE_ATTRIBUTES = freezeMap<string, ReadonlyMap<string, TranslateMode>>({
    translate: TRANSLATE_ATTRIBUTE_VALUES
});

/**
 * Class translate values
 */
export const CLASS_TRANSLATE_VALUES = freezeMap<string, TranslateMode>({
    skiptranslate: TranslateMode.Off,
    notranslate: TranslateMode.Off
});

/**
 * TK hidden attribute
 */
export const TK_HIDDEN = '_tkHidden';

/**
 * TK visible attribute
 */
export const TK_VISIBLE = '_tkVisible';

/**
 * TK attributes list
 */
export const TK_ATTRIBUTES = freezeObject([
    '_tkTextHash',
    '_tkhash',
    TK_HIDDEN,
    TK_VISIBLE,
    ...new Set(
        Array.from(TRANSLATABLE_ATTRIBUTES.values())
            .flat()
            .map(config => config.attributes)
            .flat()
            .map(attr => '_tk' + attr)
    )
]);

/**
 * Style-related attributes
 */
export const STYLE_ATTRIBUTES = freezeObject(['style', 'class']);

/**
 * Number replacement regex
 */
export const NUMBER_REGEX = /\d+(?![a-zA-Z\d\s]*\/?>)/g;

/**
 * Number placeholder
 */
export const NUMBER_PLACEHOLDER = '<>';

/**
 * Maximum visible text length
 */
export const MAX_VISIBLE_TEXT_LENGTH = 3500;

/**
 * Maximum chunk size
 */
export const MAX_CHUNK_SIZE = 4000;

/**
 * HTML entity regex
 */
export const HTML_ENTITY_REGEX = {
    AMP: /&/g,
    LT: /</g,
    GT: />/g,
    AMP_ENTITY: /&amp;/gi,
    LT_ENTITY: /&lt;/gi,
    GT_ENTITY: /&gt;/gi
};

/**
 * Tag regex
 */
export const TAG_REGEX = {
    WHITESPACE: /[^\S\r\n]+/g,
    CUSTOM_TAG: /<\s*(\/)?\s*(\w+)\s*(\d*)\s*>/g,
    HTML_TAG: /<\/?\w+>/g,
    NON_B_TAG: /<(?!\/?b\d+>)[^>]*>/g
};
