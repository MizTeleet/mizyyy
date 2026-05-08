import Foundation

struct WorkMonth: Identifiable, Codable, Equatable {
    let id: UUID
    var year: Int
    var month: Int
    var hourlyRate: Double
    var days: [WorkDay]

    init(
        id: UUID = UUID(),
        year: Int,
        month: Int,
        hourlyRate: Double = 0,
        days: [WorkDay] = []
    ) {
        self.id = id
        self.year = year
        self.month = month
        self.hourlyRate = hourlyRate
        self.days = days
    }

    var totalHours: Double {
        days.reduce(0) { total, day in
            total + (day.isWorked ? day.hours : 0)
        }
    }

    var totalEarnings: Double {
        totalHours * hourlyRate
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case year
        case month
        case hourlyRate
        case days
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        year = try container.decode(Int.self, forKey: .year)
        month = try container.decode(Int.self, forKey: .month)
        hourlyRate = try container.decodeIfPresent(Double.self, forKey: .hourlyRate) ?? 0
        days = try container.decodeIfPresent([WorkDay].self, forKey: .days) ?? []
    }
}

struct WorkDay: Identifiable, Codable, Equatable {
    let id: UUID
    var date: Date
    var isWorked: Bool
    var hours: Double

    init(id: UUID = UUID(), date: Date, isWorked: Bool = true, hours: Double = 8) {
        self.id = id
        self.date = date
        self.isWorked = isWorked
        self.hours = hours
    }
}
