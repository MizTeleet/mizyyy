import Foundation

final class WorkDataStore {
    static let shared = WorkDataStore()

    private let storageKey = "work_months_payload"

    private init() {}

    func loadMonths() -> [WorkMonth] {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            return Self.defaultMonths()
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let months = try decoder.decode([WorkMonth].self, from: data)
            return Self.mergeWithDefaultMonths(months)
        } catch {
            return Self.defaultMonths()
        }
    }

    func save(months: [WorkMonth]) {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(months)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            assertionFailure("Could not save months: \(error.localizedDescription)")
        }
    }

    private static func defaultMonths() -> [WorkMonth] {
        let calendar = Calendar.current
        let year = calendar.component(.year, from: Date())
        return (1...12).map { WorkMonth(year: year, month: $0) }
    }

    private static func mergeWithDefaultMonths(_ savedMonths: [WorkMonth]) -> [WorkMonth] {
        var result = savedMonths
        let calendar = Calendar.current
        let currentYear = calendar.component(.year, from: Date())

        for month in 1...12 where !result.contains(where: { $0.year == currentYear && $0.month == month }) {
            result.append(WorkMonth(year: currentYear, month: month))
        }

        return result.sorted { lhs, rhs in
            lhs.year == rhs.year ? lhs.month < rhs.month : lhs.year < rhs.year
        }
    }
}
