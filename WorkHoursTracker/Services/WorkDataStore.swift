import Foundation

final class WorkDataStore {
    static let shared = WorkDataStore()

    private let storageKey = "work_months_payload"

    private init() {}

    func loadMonths() -> [WorkMonth] {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            return []
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let months = try decoder.decode([WorkMonth].self, from: data)
            return Self.sorted(months)
        } catch {
            return []
        }
    }

    func save(months: [WorkMonth]) {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(Self.sorted(months))
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            assertionFailure("Could not save months: \(error.localizedDescription)")
        }
    }

    private static func sorted(_ months: [WorkMonth]) -> [WorkMonth] {
        months.sorted { lhs, rhs in
            lhs.year == rhs.year ? lhs.month < rhs.month : lhs.year < rhs.year
        }
    }
}
