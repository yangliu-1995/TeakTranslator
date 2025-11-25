# Teak Translator Testing Guide

## Testing in Chrome Console

### 1. Build Project
```bash
npm install
npm run build
```

### 2. Include in HTML Page
Create a test HTML file (test.html):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teak Translator Test</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>This is a test paragraph. It should be translated.</p>
    <p>Another paragraph with some text content.</p>
    <div>
        <span>Nested content here</span>
        <a href="#">Link text</a>
    </div>

    <script src="dist/teak.js"></script>
    <script>
        // Translator will automatically detect environment
        // In non-iOS environment, it will automatically use MockTranslator
        console.log('Teak Translator loaded:', Teak);
        console.log('Current translator:', Teak.Translator.getTranslatorApi());
    </script>
</body>
</html>
```

### 3. Test in Chrome Console

After opening test.html, execute the following commands in Chrome console:

#### Basic Test
```javascript
// View current translator (should be MockTranslator)
Teak.Translator.getTranslatorApi();

// Start page translation
Teak.Translator.startPageTranslation(
    'en',                    // Source language
    'zh-CN',                // Target language
    false,                   // Translate full page at once
    () => {                  // Intermediate complete callback
        console.log('Partial translation completed');
    },
    {
        onTranslateApiCalled: () => {
            console.log('Translation API called');
        },
        incrementTotalCharacterTranslated: (count) => {
            console.log('Translated character count:', count);
        }
    },
    (error) => {             // Error callback
        console.error('Translation error:', error);
    }
);
```

#### Stop Translation
```javascript
// Stop translation and restore page
Teak.Translator.stopPageTranslation().then(() => {
    console.log('Translation stopped, page restored');
});
```

#### Selection Translation
```javascript
// 1. First select some text on the page
// 2. Then execute in console:

Teak.Translator.startSelectionTranslation(
    'zh-CN',                // Target language
    () => {                  // Complete callback
        console.log('Selection translation completed');
    },
    {
        onTranslateApiCalled: () => {
            console.log('Translation API called');
        },
        incrementTotalCharacterTranslated: (count) => {
            console.log('Translated character count:', count);
        }
    },
    (error) => {             // Error callback
        console.error('Translation error:', error);
    }
);
```

#### Manually Switch Translator
```javascript
// Switch to MockTranslator
const mockTranslator = new Teak.Translator.MockTranslator();
Teak.Translator.setTranslatorApi(mockTranslator);
console.log('Switched to MockTranslator');

// Switch to IOSNativeTranslator (only available in iOS environment)
const iosTranslator = new Teak.Translator.IOSNativeTranslator();
Teak.Translator.setTranslatorApi(iosTranslator);
console.log('Switched to IOSNativeTranslator');
```

### 4. Verify Translation Effect

When using MockTranslator, translated text will be displayed in the following format:
```
[翻译]original content[/翻译]
```

For example:
- Original: `Hello World`
- Translated: `[翻译]Hello World[/翻译]`

This makes it easy to see which content has been translated.

### 5. Debugging Tips

```javascript
// Enable Debug logs (if needed)
// Note: Need to enable debug mode in source code

// View translation status
console.log('Translator instance:', Teak.Translator.getTranslatorApi());

// Test single element translation
const testDiv = document.querySelector('p');
console.log('Test element:', testDiv);
```

## MockTranslator Features

MockTranslator has the following features:
1. **Simulates network delay**: 100ms delay per translation, simulating real network requests
2. **Marks translated content**: Adds `[翻译]` and `[/翻译]` markers before and after original text
3. **Preserves source language info**: Returns source language code (if provided)
4. **Suitable for testing**: Can clearly see which content has been translated

## Custom Translator

You can also create your own translator to test different translation logic:

```javascript
class CustomTranslator extends Teak.Translator.BaseTranslator {
    async translateAsync(fromLang, toLang, textArray) {
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

## Notes

1. **Environment Detection**: Code will automatically detect if running in iOS environment, if not, automatically uses MockTranslator
2. **Console Logs**: In non-iOS environment, will print "Using MockTranslator for testing"
3. **HTML Structure**: Ensure test page has enough text content to observe translation effects
4. **Performance**: MockTranslator simulates 100ms delay, translating large amounts of content may take some time
