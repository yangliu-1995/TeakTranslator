tkTranslator.bingTranslator = (function() {
    function onSuccessCallback() {
        console.log("success")
        window.webkit.messageHandlers.translator
            .postMessage({
            command: 'TranslateResult',
            value: 0
        })
    }
    function onErrorCallback(error) {
        console.error(error)
        window.webkit.messageHandlers.translator
            .postMessage({
            command: 'TranslateResult',
            value: -1
        })
    }
    function onTranslateApiCalled(translationDetails) {
    }
    function incrementTotalCharacterTranslated(totalCharactersTranslated){
    }
    function doTranslate(originalLang, targetLang) {
        try {
            Teak.Translator.startPageTranslation(originalLang, targetLang, false, onSuccessCallback, {
                onTranslateApiCalled,
                incrementTotalCharacterTranslated,
              }, onErrorCallback);
        } catch (err) {
            console.error('tkTranslator error: ' + err);
        }
    }
    return {
        translate(originalLang, targetLang) {
            doTranslate(originalLang, targetLang);
        },
        stop() {
            try {
                Teak.Translator.stopPageTranslation();
            } catch (err) {
                console.error('tkTranslator stop error: ' + err);
            }
        }
    }
})();
