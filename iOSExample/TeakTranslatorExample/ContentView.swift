import SwiftUI
import WebKit

enum Language: String {
    case zh_cn
    case ja
    case ko
    case fr

    var toValue: String {
        switch self {
        case .zh_cn:
            "zh-Hans"
        case .ja:
            "ja"
        case .ko:
            "ko"
        case .fr:
            "fr"
        }
    }

    var title: String {
        switch self {
        case .zh_cn:
            "Chinese"
        case .ja:
            "Japanese"
        case .ko:
            "Korean"
        case .fr:
            "France"
        }
    }
}

struct ContentView: View {
    private let messageHandler: TranslateMessageHandler

    private let webPage: WebPage

    @State private var urlText = "https://www.webkit.org"

    @State private var isProgressBarHidden = true

    @State private var translated = false

    private let availableLanguages: [Language] = [
        .zh_cn,
        .ja,
        .ko,
        .fr
    ]

    @State private var targetLanguage: Language = .zh_cn

    init() {
        messageHandler = TranslateMessageHandler()
        let configuration = WebPage.Configuration()
        configuration.userContentController.addScriptMessageHandler(messageHandler, contentWorld: .defaultClient, name: "translator")
        let defineScript = JavaScriptUtil.loadLocalJavaScript(with: "TranslateDefine")
        let domScript = JavaScriptUtil.loadLocalJavaScript(with: "TeakTranslator")
        let script = """
        var tkTranslator = tkTranslator || {};
        var Teak = Teak || {};
        if (typeof(Teak.Translator) === 'undefined') {
            \(domScript);
        }
        window.tkTranslator = tkTranslator
        \(defineScript)
        """
        configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .defaultClient))
        webPage = WebPage(configuration: configuration)
    }

    var body: some View {
        VStack {
            WebView(webPage)
                .padding(.top)
            if isProgressBarHidden {
                Color.clear
                    .frame(height: 5)
            } else {
                ProgressView(value: webPage.estimatedProgress, total: 1)
                    .frame(height: 5)
            }

            HStack {
                Text("To:")
                    .padding(.leading, 16)
                Menu {
                    ForEach(availableLanguages, id: \.self) { language in
                        Button(action: {
                            targetLanguage = language
                        }) {
                            HStack {
                                Text(language.title)
                                if targetLanguage == language {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack {
                        Text(targetLanguage.title)
                        Image(systemName: "chevron.up.chevron.down")
                    }
                }

                Spacer()
                Button(action: {
                    if translated {
                        stopTranslate()
                    } else {
                        doTranslate()
                    }
                }) {
                    if translated {
                        Text("Show Original Text")
                    } else {
                        Text("Translate")
                    }
                }
                .buttonStyle(.glassProminent)
                .padding(.trailing, 16)
            }
            .disabled(webPage.isLoading)

            TextField("url", text: $urlText)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background {
                    Capsule().fill(.gray.opacity(0.2))
                }
                .padding(.horizontal)
                .onSubmit {
                    loadPageIfPossible()
                }
        }
        .onAppear {
            messageHandler.translateResultHandler = { success in
                translated = success
            }
            webPage.isInspectable = true
            loadPageIfPossible()
        }
    }

    private func loadPageIfPossible() {
        guard let url = URL(string: urlText) else {
            return
        }
        webPage.load(url)
    }

    private func doTranslate() {
        let script = """
        try {
            window.tkTranslator.bingTranslator.translate('','\(targetLanguage.toValue)');
        } catch (err) {
            console.error("tkTranslator start error:" + err);
        }
        """
        Task {
            do {
                try await webPage.callJavaScript(script, contentWorld: .defaultClient)
            } catch {
                print(error)
            }
        }
    }

    private func stopTranslate() {
        let script = """
        try {
            window.tkTranslator.bingTranslator.stop();
        } catch (err) {
            console.error("tkTranslator stop error:" + err);
        }
        """
        Task {
            do {
                try await webPage.callJavaScript(script, contentWorld: .defaultClient)
                await MainActor.run {
                    translated = false
                }
            } catch {
                print(error)
            }
        }
    }
}

struct JavaScriptUtil {
    static func loadLocalJavaScript(with name: String) -> String {
        guard let path = Bundle.main.url(forResource: name, withExtension: "js"),
              let data = try? Data(contentsOf: path),
              let script = String(data: data, encoding: .utf8) else {
            fatalError()
        }
        return script
    }
    static func javaScriptTime(for date: Date) -> Int {
        return Int(date.timeIntervalSince1970 * 1000)
    }
}

class TranslateMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
    var translateResultHandler: ((Bool) -> Void)?

    private let translator: TranslateViewModel

    override init() {
        #warning("Set you Azure api key")
        translator = BingTranslateViewModel(apiKey: "{YOU_API_KEY}", region: "eastasia")
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor (Any?, String?) -> Void) {
        guard let messsageBody = message.body as? [String: Any],
              let command = messsageBody["command"] as? String else {
            DispatchQueue.main.async {
                replyHandler(nil, "Unsupported js call: command is null")
            }
            return
        }
        if command == "IOSNativeRequest" {
            if let fromLang = messsageBody["fromLang"] as? String,
               let toLang = messsageBody["toLang"] as? String,
               let textArray = messsageBody["textArray"] as? [String] {
                Task.detached {
                    do {
                        let translator = await self.translator
                        let resArr = try await translator.translate(texts: textArray, from: fromLang.isEmpty ? "auto" : fromLang, to: toLang)
                        await MainActor.run {
                            replyHandler(resArr.map({ ["translatedText": $0, "fromLang": fromLang] }), nil)
                        }
                    } catch {
                        await MainActor.run {
                            replyHandler(nil, error.localizedDescription)
                        }
                    }
                }
            } else {
                DispatchQueue.main.async {
                    replyHandler(nil, "Unsupported params")
                }
            }
        } else if command == "TranslateResult" {
            if let value = messsageBody["value"] as? Int {
                DispatchQueue.main.async {
                    self.translateResultHandler?(value == 0)
                }
            } else {
                DispatchQueue.main.async {
                    self.translateResultHandler?(false)
                }
            }
        } else {
            DispatchQueue.main.async {
                replyHandler(nil, "Unsupported params")
            }
        }
    }
}

#Preview {
    ContentView()
}
