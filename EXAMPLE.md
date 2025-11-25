# Teak Translator Usage Examples

## Basic Examples

### 1. Include in HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>Translation Test</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>This is a test paragraph.</p>

    <script src="dist/teak.js"></script>
    <script>
        // Teak variable is automatically injected globally
        console.log(Teak);
    </script>
</body>
</html>
```

### 2. Basic Translation

```javascript
// Start page translation
Teak.Translator.startPageTranslation(
    'en',                    // Source language
    'zh-CN',                // Target language
    false,                   // Progressive translation
    null,                    // Intermediate complete callback (optional)
    {
        onTranslateApiCalled: () => {
            console.log('Translation API called');
        },
        incrementTotalCharacterTranslated: (count) => {
            console.log('Translated character count:', count);
        }
    },
    (error) => {
        console.error('Translation failed:', error);
    }
);
```

### 3. Stop Translation

```javascript
// Stop translation and restore page
Teak.Translator.stopPageTranslation().then(() => {
    console.log('Page restored');
});
```

## Advanced Examples

### 1. Translation with Progress Display

```html
<!DOCTYPE html>
<html>
<head>
    <title>Translation Progress Example</title>
    <style>
        #progress {
            width: 100%;
            height: 30px;
            background: #f0f0f0;
            border-radius: 15px;
            overflow: hidden;
        }
        #progress-bar {
            height: 100%;
            background: #4caf50;
            width: 0%;
            transition: width 0.3s;
        }
    </style>
</head>
<body>
    <h1>Translation Progress Demo</h1>
    <div id="progress">
        <div id="progress-bar"></div>
    </div>
    <p id="status">Ready to translate...</p>
    
    <button onclick="startTranslation()">Start Translation</button>
    <button onclick="stopTranslation()">Stop Translation</button>

    <div id="content">
        <p>This is the first paragraph to translate.</p>
        <p>This is the second paragraph to translate.</p>
        <p>This is the third paragraph to translate.</p>
    </div>

    <script src="dist/teak.js"></script>
    <script>
        let totalChars = 0;
        let translatedChars = 0;

        function updateProgress() {
            const percentage = (translatedChars / totalChars * 100).toFixed(0);
            document.getElementById('progress-bar').style.width = percentage + '%';
            document.getElementById('status').textContent = 
                `Translation progress: ${percentage}% (${translatedChars}/${totalChars} characters)`;
        }

        function startTranslation() {
            // Estimate total character count
            const content = document.getElementById('content');
            totalChars = content.textContent.length;
            translatedChars = 0;
            updateProgress();

            Teak.Translator.startPageTranslation(
                'en',
                'zh-CN',
                false,
                () => {
                    document.getElementById('status').textContent = 'Translation completed!';
                },
                {
                    onTranslateApiCalled: () => {
                        console.log('API called');
                    },
                    incrementTotalCharacterTranslated: (count) => {
                        translatedChars += count;
                        updateProgress();
                    }
                },
                (error) => {
                    document.getElementById('status').textContent = 'Translation failed: ' + error;
                    document.getElementById('progress-bar').style.background = '#f44336';
                }
            );
        }

        function stopTranslation() {
            Teak.Translator.stopPageTranslation().then(() => {
                document.getElementById('status').textContent = 'Restored';
                document.getElementById('progress-bar').style.width = '0%';
            });
        }
    </script>
</body>
</html>
```

### 2. Selection Translation

```javascript
// Call after user selects text
function translateSelection() {
    Teak.Translator.startSelectionTranslation(
        'zh-CN',
        () => {
            alert('Selected text translation completed!');
        },
        {
            onTranslateApiCalled: () => {
                console.log('Selection translation API called');
            },
            incrementTotalCharacterTranslated: (count) => {
                console.log('Translated characters:', count);
            }
        },
        (error) => {
            alert('Translation failed: ' + error);
        }
    );
}

// Add context menu
document.addEventListener('contextmenu', (e) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
        e.preventDefault();
        if (confirm('Translate selected text?')) {
            translateSelection();
        }
    }
});
```

### 3. Using Custom Translator

```javascript
// Create custom translator
class ReverseTranslator extends Teak.Translator.BaseTranslator {
    async translateAsync(fromLang, toLang, textArray) {
        // Reverse text as "translation"
        return textArray.map(text => ({
            TranslatedText: text.split('').reverse().join(''),
            From: fromLang || 'auto'
        }));
    }
}

// Use custom translator
const reverseTranslator = new ReverseTranslator();
Teak.Translator.setTranslatorApi(reverseTranslator);

// Start translation
Teak.Translator.startPageTranslation('en', 'zh-CN', false, null, {
    onTranslateApiCalled: () => console.log('Using reverse translator'),
    incrementTotalCharacterTranslated: (n) => console.log('Character count:', n)
}, console.error);
```

### 4. Uppercase Converter Translator (Example)

```javascript
class UppercaseTranslator extends Teak.Translator.BaseTranslator {
    async translateAsync(fromLang, toLang, textArray) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const results = textArray.map(text => ({
                    TranslatedText: text.toUpperCase(),
                    From: fromLang || 'auto'
                }));
                resolve(results);
            }, 50);
        });
    }
}

// Usage
Teak.Translator.setTranslatorApi(new UppercaseTranslator());
```

### 5. Debugging and Logging

```javascript
// Wrap translator to add logging
class LoggingTranslator extends Teak.Translator.MockTranslator {
    async translateAsync(fromLang, toLang, textArray) {
        console.group('Translation Request');
        console.log('Source language:', fromLang);
        console.log('Target language:', toLang);
        console.log('Text count:', textArray.length);
        console.log('Text content:', textArray);
        console.groupEnd();

        const result = await super.translateAsync(fromLang, toLang, textArray);

        console.group('Translation Result');
        console.log('Result:', result);
        console.groupEnd();

        return result;
    }
}

// Use logging translator
Teak.Translator.setTranslatorApi(new LoggingTranslator());
```

## Utility Functions

### 1. Translation State Management

```javascript
class TranslationManager {
    constructor() {
        this.isTranslating = false;
        this.currentLang = null;
    }

    async translate(fromLang, toLang) {
        if (this.isTranslating) {
            console.warn('Translation in progress...');
            return;
        }

        this.isTranslating = true;
        this.currentLang = toLang;

        return new Promise((resolve, reject) => {
            Teak.Translator.startPageTranslation(
                fromLang,
                toLang,
                false,
                () => {
                    console.log('Translation completed');
                    this.isTranslating = false;
                    resolve();
                },
                {
                    onTranslateApiCalled: () => {},
                    incrementTotalCharacterTranslated: (n) => {
                        console.log('Progress:', n);
                    }
                },
                (error) => {
                    console.error('Error:', error);
                    this.isTranslating = false;
                    reject(error);
                }
            );
        });
    }

    async restore() {
        await Teak.Translator.stopPageTranslation();
        this.isTranslating = false;
        this.currentLang = null;
    }
}

// Usage
const manager = new TranslationManager();
manager.translate('en', 'zh-CN');
```

### 2. Multi-language Switcher

```javascript
const languages = {
    'zh-CN': 'Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean'
};

function createLanguageSwitcher() {
    const select = document.createElement('select');
    select.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select language';
    select.appendChild(defaultOption);

    for (const [code, name] of Object.entries(languages)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        select.appendChild(option);
    }

    select.addEventListener('change', (e) => {
        const lang = e.target.value;
        if (lang) {
            Teak.Translator.startPageTranslation(
                'auto',
                lang,
                false,
                null,
                {
                    onTranslateApiCalled: () => {},
                    incrementTotalCharacterTranslated: () => {}
                },
                console.error
            );
        } else {
            Teak.Translator.stopPageTranslation();
        }
    });

    document.body.appendChild(select);
}

// Add language switcher after page load
window.addEventListener('load', createLanguageSwitcher);
```

## Test Scenarios

### 1. Dynamic Content Test

```javascript
// Test if dynamically added content will be translated
function addDynamicContent() {
    const p = document.createElement('p');
    p.textContent = 'This is dynamically added content.';
    document.body.appendChild(p);
}

// Start translation first
Teak.Translator.startPageTranslation('en', 'zh-CN', false, null, {
    onTranslateApiCalled: () => {},
    incrementTotalCharacterTranslated: () => {}
}, console.error);

// Add content after 3 seconds, observe if auto-translated
setTimeout(addDynamicContent, 3000);
```

### 2. Performance Test

```javascript
function performanceTest() {
    const startTime = performance.now();
    
    Teak.Translator.startPageTranslation(
        'en',
        'zh-CN',
        false,
        () => {
            const endTime = performance.now();
            const duration = (endTime - startTime) / 1000;
            console.log(`Translation time: ${duration.toFixed(2)} seconds`);
        },
        {
            onTranslateApiCalled: () => {},
            incrementTotalCharacterTranslated: () => {}
        },
        console.error
    );
}

performanceTest();
```

## Troubleshooting

### 1. Check Translator Type

```javascript
const currentTranslator = Teak.Translator.getTranslatorApi();
console.log('Current translator type:', currentTranslator.constructor.name);

if (currentTranslator.constructor.name === 'MockTranslator') {
    console.log('✓ Using Mock translator (test mode)');
} else {
    console.log('✓ Using iOS native translator');
}
```

### 2. Test if Translator is Working

```javascript
async function testTranslator() {
    const translator = Teak.Translator.getTranslatorApi();
    const result = await translator.translateAsync('en', 'zh-CN', ['Hello World']);
    console.log('Test result:', result);
}

testTranslator();
```

---

For more examples, see `test.html` and `TEST.md`
