import Combine
import FoundationModels
import Foundation

protocol TranslateViewModel {
    func translate(texts: [String], from: String, to: String) async throws -> [String]
}

@MainActor
final class BingTranslateViewModel: ObservableObject, TranslateViewModel {
    private let apiKey: String
    private let region: String
    private let endpoint = "https://api.cognitive.microsofttranslator.com"

    init(apiKey: String, region: String = "global") {
        self.apiKey = apiKey
        self.region = region
    }

    func translate(texts: [String], from: String, to: String) async throws -> [String] {
        let nonEmptyTexts = texts
            .enumerated()
            .filter { !$0.element.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .map { $0.element }

        guard !nonEmptyTexts.isEmpty else {
            return Array(repeating: "", count: texts.count)
        }

        let body = nonEmptyTexts.map { ["text": $0] }
        let jsonData = try JSONSerialization.data(withJSONObject: body)

        var components = URLComponents(string: "\(endpoint)/translate")!
        components.queryItems = [
            URLQueryItem(name: "api-version", value: "3.0"),
            URLQueryItem(name: "to", value: to),
        ]
        if from != "auto" {
            components.queryItems?.append(URLQueryItem(name: "from", value: from))
        } else {
            components.queryItems?.append(URLQueryItem(name: "from", value: ""))
        }

        guard let url = components.url else {
            throw TranslationError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = jsonData
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")
        request.setValue(region, forHTTPHeaderField: "Ocp-Apim-Subscription-Region")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-ClientTraceId")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TranslationError.networkError
        }

        switch httpResponse.statusCode {
        case 200:
            break
        case 401:
            throw TranslationError.invalidApiKey
        case 429:
            throw TranslationError.tooManyRequests
        case 400...499:
            throw TranslationError.badRequest(httpResponse.statusCode)
        default:
            throw TranslationError.serverError(httpResponse.statusCode)
        }

        // [[ "translations": [ [ "text": "...", "to": "en" ] ] ]]
        let json = try JSONSerialization.jsonObject(with: data)
        guard let array = json as? [[String: Any]] else {
            throw TranslationError.invalidResponse
        }

        var results: [String] = []
        for item in array {
            if let translations = item["translations"] as? [[String: Any]],
               let first = translations.first,
               let text = first["text"] as? String {
                results.append(text)
            } else {
                results.append("")
            }
        }

        var finalResults: [String] = []
        var resultIndex = 0
        for originalText in texts {
            if originalText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                finalResults.append("")
            } else {
                finalResults.append(results[resultIndex])
                resultIndex += 1
            }
        }

        return finalResults
    }
}

// MARK: - 错误类型
enum TranslationError: Error, LocalizedError {
    case invalidURL
    case networkError
    case invalidApiKey
    case tooManyRequests
    case badRequest(Int)
    case serverError(Int)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Failed to construct URL"
        case .networkError:
            return "Network request failed"
        case .invalidApiKey:
            return "Invalid or expired API key"
        case .tooManyRequests:
            return "Too many requests, please try again later"
        case .badRequest(let code):
            return "Bad request (HTTP \(code))"
        case .serverError(let code):
            return "Server error (HTTP \(code))"
        case .invalidResponse:
            return "Invalid response from translation service"
        }
    }
}
