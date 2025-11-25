# Teak Translator Debug Guide

## 🐛 Debug Mode Description

Debug mode provides unminified code and complete Source Maps for easier developer debugging.

## 🚀 Quick Start

### 1. Build Debug Version

```bash
# Single build
npm run build:dev

# Continuous watch mode (auto-rebuild on file changes)
npm run dev
```

The configuration automatically adjusts based on the `--mode` parameter:
- **Production mode** (`--mode production`): Minified, no source maps
- **Development mode** (`--mode development`): Unminified, with source maps

### 2. Use Debug Version

Open the `test-debug.html` file in Chrome browser for testing.

## 📊 Version Comparison

| Version | Filename | Size | Features |
|---------|----------|------|----------|
| **Production** | `TeakTranslator.js` | ~49KB | ✅ Minified<br>✅ Small size<br>❌ Hard to debug |
| **Development** | `TeakTranslator.js` | ~163KB | ✅ Unminified<br>✅ Full Source Maps<br>✅ Easy to debug |

## 🔍 Debugging Tips

### 1. Debugging in Chrome DevTools

1. **Open DevTools**
   - Windows/Linux: `F12` or `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`

2. **Switch to Sources Tab**
   - Find `webpack://` in the left file tree
   - Expand the `./src/` directory
   - You can see the complete TypeScript source code

3. **Set Breakpoints**
   - Click on line numbers to set breakpoints
   - Red dot indicates breakpoint is set
   - Execution will pause at breakpoints when triggered

4. **Debug Controls**
   - `F8` / `Cmd+\`: Continue execution
   - `F10` / `Cmd+'`: Step Over (skip function)
   - `F11` / `Cmd+;`: Step Into (enter function)
   - `Shift+F11` / `Cmd+Shift+;`: Step Out (exit function)

### 2. Using Console for Debugging

```javascript
// View translator internal state
const translator = Teak.Translator.getTranslatorApi();
console.log('Translator:', translator);
console.log('Constructor:', translator.constructor.name);
console.log('Prototype:', Object.getPrototypeOf(translator));

// View all available methods
console.log('Method list:', Object.getOwnPropertyNames(Object.getPrototypeOf(translator)));
```

### 3. Using debugger Statement

Add `debugger` statement in code:

```javascript
function myFunction() {
    debugger; // Program will pause here
    // ... your code
}
```

### 4. Watch Variables

Add expressions in DevTools Watch panel:
- `Teak.Translator.getTranslatorApi()`
- `document.querySelectorAll('[_tkHash]').length`
- `navigator.userAgent`

## 📝 Common Debugging Scenarios

### Scenario 1: Debug Translation Flow

1. Set breakpoint in `page-translator.ts` at `executeTranslation()` method
2. Click "Start Page Translation" button
3. Program will pause at breakpoint
4. Use Step Over/Into to execute step by step

### Scenario 2: View DOM Traversal Process

1. Set breakpoint in `traverseDOM()` method
2. Observe changes in `domStack` variable
3. Understand traversal order and logic

### Scenario 3: Check Translation API Calls

1. Set breakpoint in `translator-api.ts` at `translateAsync()` method
2. View incoming parameters
3. View returned results

### Scenario 4: Analyze Performance Issues

1. Use Performance tab to record performance
2. Analyze function call stack
3. Find performance bottlenecks

## 🛠️ Debug Version Features

### 1. Complete Source Maps

Debug version includes complete Source Maps, allowing you to:
- Set breakpoints in original TypeScript code
- View original variable names (not obfuscated)
- Trace complete call stack

### 2. Unminified Code

Code maintains original format:
- Preserve all newlines and indentation
- Preserve comments (if any)
- Variable names not obfuscated
- Easy to read and understand

### 3. Detailed Log Output

test-debug.html includes enhanced logging features:
- All console output displayed on page
- With timestamps
- Color-coded by type (log/error/warn/debug)

## 📋 Debug Command Reference

### NPM Scripts

```bash
# Build development version (once)
npm run build:dev

# Continuous development mode (watch file changes)
npm run dev

# Rebuild development version
npm run rebuild:dev

# Clean and rebuild
npm run clean && npm run build:dev
```

### Chrome Console Commands

```javascript
// Basic operations
Teak.Translator.startPageTranslation('en', 'zh-CN', false, null, {...}, console.error);
Teak.Translator.stopPageTranslation();

// View status
Teak.Translator.getTranslatorApi();

// Switch translator
Teak.Translator.setTranslatorApi(new Teak.Translator.MockTranslator());

// View translated elements in DOM
document.querySelectorAll('[_tkHash]');

// View translation markers
document.querySelectorAll('[_isTranslated]');

// View hidden elements
document.querySelectorAll('[_tkHidden]');

// View visible elements
document.querySelectorAll('[_tkVisible]');
```

## 🎯 Best Practices

### 1. Use Debug Version During Development

```bash
# Start continuous watch
npm run dev

# Start local server in another terminal (if needed)
python -m http.server 8000
# or
npx serve
```

### 2. Switch Versions for Testing

- **Functionality Testing**: Use debug version
- **Performance Testing**: Use production version
- **Integration Testing**: Test both versions

### 3. Pre-commit Checks

```bash
# Ensure production version builds correctly
npm run build

# Ensure development version builds correctly
npm run build:dev

# Run type checking
npm run type-check
```

## 🔧 Troubleshooting

### Issue 1: Source Maps Cannot Load

**Solution:**
- Ensure `TeakTranslator.js.map` file exists
- Check "Enable JavaScript source maps" is enabled in Chrome DevTools settings

### Issue 2: Breakpoint Not Triggered

**Solution:**
- Ensure using `test-debug.html` instead of `test.html`
- Check if breakpoint is set on actually executed code path
- Try adding `debugger` statement to force pause

### Issue 3: Cannot Find Source Code

**Solution:**
- Press `Ctrl+P` (Mac: `Cmd+P`) in DevTools to quick open file
- Search for filename, e.g., "page-translator"
- Ensure Source Maps are loaded correctly

### Issue 4: Variable Shows as undefined

**Solution:**
- May have been optimized out, try setting breakpoint earlier
- Check variable scope
- Use Watch panel to add expressions

## 📚 Related Resources

- [Chrome DevTools Debugging Guide](https://developers.google.com/web/tools/chrome-devtools/javascript)
- [Source Maps Explanation](https://developer.chrome.com/blog/sourcemaps/)
- [Webpack DevTool Configuration](https://webpack.js.org/configuration/devtool/)

## 💡 Tips

1. **Use Conditional Breakpoints**: Right-click breakpoint to set conditions, pause only in specific situations
2. **Use Logpoints**: Add console.log without modifying code
3. **Save Debug Configuration**: Chrome remembers your breakpoint locations
4. **Use Snippets**: Save frequently used debug code in Sources > Snippets

---

**Happy Debugging! 🐛🔍**
