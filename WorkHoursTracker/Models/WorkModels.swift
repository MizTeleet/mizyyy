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
    var workName: String
    var startTime: Date
    var endTime: Date

    var hours: Double {
        guard isWorked else { return 0 }
        let interval = normalizedEndTime.timeIntervalSince(startTime)
        return max(interval / 3600, 0)
    }

    private var normalizedEndTime: Date {
        if endTime >= startTime {
            return endTime
        }
        return Calendar.current.date(byAdding: .day, value: 1, to: endTime) ?? endTime
    }

    init(
        id: UUID = UUID(),
        date: Date,
        isWorked: Bool = true,
        workName: String = "",
        startTime: Date? = nil,
        endTime: Date? = nil,
        hours: Double = 8
    ) {
        let calendar = Calendar.current
        let normalizedDate = calendar.startOfDay(for: date)
        self.id = id
        self.date = normalizedDate
        self.isWorked = isWorked
        self.workName = workName
        self.startTime = startTime ?? normalizedDate
        self.endTime = endTime ?? (calendar.date(byAdding: .minute, value: Int((hours * 60).rounded()), to: normalizedDate) ?? normalizedDate)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case date
        case isWorked
        case workName
        case startTime
        case endTime
        case hours
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let calendar = Calendar.current
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        date = calendar.startOfDay(for: try container.decode(Date.self, forKey: .date))
        isWorked = try container.decodeIfPresent(Bool.self, forKey: .isWorked) ?? true
        workName = try container.decodeIfPresent(String.self, forKey: .workName) ?? ""

        if let decodedStart = try container.decodeIfPresent(Date.self, forKey: .startTime),
           let decodedEnd = try container.decodeIfPresent(Date.self, forKey: .endTime) {
            startTime = decodedStart
            endTime = decodedEnd
        } else {
            let legacyHours = try container.decodeIfPresent(Double.self, forKey: .hours) ?? 0
            startTime = date
            endTime = calendar.date(byAdding: .minute, value: Int((legacyHours * 60).rounded()), to: date) ?? date
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(date, forKey: .date)
        try container.encode(isWorked, forKey: .isWorked)
        try container.encode(workName, forKey: .workName)
        try container.encode(startTime, forKey: .startTime)
        try container.encode(endTime, forKey: .endTime)
        try container.encode(hours, forKey: .hours)
    }
}
