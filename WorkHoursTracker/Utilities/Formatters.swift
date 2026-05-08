import Foundation

enum Formatters {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.dateFormat = "d MMMM yyyy"
        return formatter
    }()

    static func hours(_ value: Double) -> String {
        decimal(value, maximumFractionDigits: 2)
    }

    static func money(_ value: Double) -> String {
        decimal(value, maximumFractionDigits: 2)
    }

    static func rate(_ value: Double) -> String {
        decimal(value, maximumFractionDigits: 2)
    }

    private static func decimal(_ value: Double, maximumFractionDigits: Int) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = maximumFractionDigits
        formatter.decimalSeparator = "."
        return formatter.string(from: NSNumber(value: value)) ?? "0"
    }
}
