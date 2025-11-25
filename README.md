# Teak Translator

A powerful web page translation tool that supports iOS native translation and mock translator for testing.

## 📋 Project Overview

Teak Translator is a modular TypeScript web translation library, fully restored from the logic of original.js, with the following features:

- ✅ 100% TypeScript type safety
- ✅ Modular architecture, easy to maintain
- ✅ Supports iOS native translation API
- ✅ Built-in MockTranslator for development testing
- ✅ Automatic environment detection
- ✅ DOM Mutation Observer support
- ✅ Visibility optimization
- ✅ RTL language support
- ✅ iframe and Shadow DOM support
- ✅ Translation caching mechanism

## 🏗️ Project Structure

```
src/
├── types/              # Type definitions
│   ├── enums.ts       # Enum types
│   └── interfaces.ts   # Interface definitions
├── utils/              # Utility modules
│   ├── logger.ts      # Logging utility
│   ├── state.ts       # State management
│   ├── helpers.ts     # Helper functions
│   └── dom-helpers.ts # DOM helper functions
├── data-structures/    # Data structures
│   └── stack.ts       # Stack implementation
├── core/               # Core functionality
│   ├── base-translator.ts    # Translator base class (abstract)
│   ├── translator-api.ts     # Translator API (iOS and Mock implementations)
│   ├── page-translator.ts    # Page translator
│   ├── selection-translator.ts # Selection translation
│   └── ... other core modules
├── api/                # Public API
│   └── translate-api.ts
└── index.ts            # Main entry point
```

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Development Mode (Watch mode)

```bash
npm run dev
```

### Production Build (Minified)

```bash
npm run build
```

### Development Build (Unminified with Source Maps)

```bash
npm run build:dev
```

Teak Translator uses a **single Webpack configuration** that adapts based on the mode:
- **Production mode**: Automatically minifies code, optimizes for size
- **Development mode**: Keeps code readable, generates source maps for debugging

After building, the file will be generated in the `dist/` directory:
- **File name**: `TeakTranslator.js` (both production and development versions use the same filename)
- **Production version**: Minified, smaller size (~49KB)
- **Development version**: Unminified with source maps, easy to debug (~163KB + source map file)

## 🧪 Testing

### Testing in Chrome Browser

**Production Version Testing:**
1. Build the project:
```bash
npm run build
```
2. Open the `test.html` file
3. Test using buttons on the page or Chrome console

**Development Mode Testing:**
1. Build development version:
```bash
npm run build:dev
```
2. Open the `test-debug.html` file
3. Open Chrome DevTools (F12)
4. View complete source code in the Sources tab
5. Set breakpoints and debug

### Translator Architecture

The project uses abstract class design, all translators inherit from `BaseTranslator`:

```typescript
// Abstract base class
abstract class BaseTranslator {
    abstract translateAsync(
        fromLang: string,
        toLang: string,
        textArray: string[]
    ): Promise<TranslateResponse[]>;
}

// iOS native translator
class IOSNativeTranslator extends BaseTranslator {
    // Uses iOS native translation API
}

// Mock translator (for testing)
class MockTranslator extends BaseTranslator {
    // Returns: [traslated]original text[/traslated]
}
```

### Automatic Environment Detection

The code automatically detects the runtime environment:
- **iOS environment**: Uses `IOSNativeTranslator`
- **Non-iOS environment**: Automatically uses `MockTranslator` for testing

### Console Testing Commands

```javascript
// View current translator
Teak.Translator.getTranslatorApi();

// Start page translation
Teak.Translator.startPageTranslation(
    'en',           // Source language
    'zh-CN',        // Target language
    false,          // Translate full page at once
    () => console.log('Partial complete'),
    {
        onTranslateApiCalled: () => console.log('API called'),
        incrementTotalCharacterTranslated: (n) => console.log('Characters:', n)
    },
    (err) => console.error('Error:', err)
);

// Stop translation
Teak.Translator.stopPageTranslation();

// Manually switch translator
Teak.Translator.setTranslatorApi(new Teak.Translator.MockTranslator());
```

### MockTranslator Features

MockTranslator converts text to: `[traslated]original text[/traslated]`

Example:
- Original: `Hello World`
- Translated: `[traslated]Hello World[/traslated]`

This makes it easy to see which content has been translated.

## 📖 API Documentation

### startPageTranslation

Translate the entire page.

```typescript
Teak.Translator.startPageTranslation(
    fromLang: string,
    toLang: string,
    translateFullPageInOneGo: boolean,
    onIntermediateComplete: (() => void) | null,
    translateDataCallbacks: {
        onTranslateApiCalled: () => void;
        incrementTotalCharacterTranslated: (count: number) => void;
    },
    onError: (error: string) => void
): void
```

### startSelectionTranslation

Translate user-selected text.

```typescript
Teak.Translator.startSelectionTranslation(
    toLang: string,
    onIntermediateComplete: () => void,
    translateDataCallbacks: {
        onTranslateApiCalled: () => void;
        incrementTotalCharacterTranslated: (count: number) => void;
    },
    onError: (error: string) => void
): Promise<any>
```

### stopPageTranslation

Stop translation and restore the page.

```typescript
Teak.Translator.stopPageTranslation(): Promise<void>
```

### setTranslatorApi

Set a custom translator.

```typescript
Teak.Translator.setTranslatorApi(translator: BaseTranslator): void
```

### getTranslatorApi

Get the current translator instance.

```typescript
Teak.Translator.getTranslatorApi(): BaseTranslator
```

## 🔧 Custom Translator

You can create your own translator implementation:

```javascript
class CustomTranslator extends Teak.Translator.BaseTranslator {
    async translateAsync(fromLang, toLang, textArray) {
        // Custom translation logic
        return textArray.map(text => ({
            TranslatedText: `【${toLang}】${text}`,
            From: fromLang || 'auto'
        }));
    }
}

// Use custom translator
const customTranslator = new CustomTranslator();
Teak.Translator.setTranslatorApi(customTranslator);
```

## 📝 Core Features

### DOM Traversal and Translation
- Smart DOM tree traversal
- Identify translatable content
- Support for inline and block elements
- Handle special tags (script, style, etc.)

### Visibility Detection
- Prioritize visible content translation
- Scroll listening
- Defer translation of off-screen content

### Mutation Observer
- Listen to DOM changes
- Automatically translate newly added content
- Support for dynamic web pages

### Translation Cache
- LRU cache strategy
- Reduce duplicate translations
- Improve performance

### Special Support
- iframe content translation
- Shadow DOM support
- RTL languages (Arabic, Hebrew, etc.)
- Form element attribute translation (placeholder, aria-label, etc.)

## 📄 File Descriptions

- **test.html** - Chrome browser test page (with visual console)
- **TEST.md** - Detailed testing guide
- **README.md** - Project documentation
- **original.js** - Original source code (for reference)

## 🔍 Debugging

You can view detailed translation process in Chrome console:

```javascript
// When environment is not iOS, it will automatically output:
// "Using MockTranslator for testing"

// All translation processes will output logs to console
```

## ⚠️ Notes

1. **Environment Detection**: Code automatically detects if running in iOS environment
2. **Mock Delay**: MockTranslator simulates 100ms network delay
3. **Cache Mechanism**: Same content will not be translated repeatedly
4. **Restore Function**: Can fully restore to pre-translation state

## 📜 License

MIT

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

**Happy Translating! 🌍**
