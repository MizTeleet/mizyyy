import Foundation

struct WorkMonth: Identifiable, Codable, Equatable {
    let id: UUID
    var year: Int
    var month: Int
    var backgroundImageFilename: String?
    var days: [WorkDay]

    init(
        id: UUID = UUID(),
        year: Int,
        month: Int,
        backgroundImageFilename: String? = nil,
        days: [WorkDay] = []
    ) {
        self.id = id
        self.year = year
        self.month = month
        self.backgroundImageFilename = backgroundImageFilename
        self.days = days
    }

    var totalHours: Double {
        days.reduce(0) { total, day in
            total + (day.isWorked ? day.hours : 0)
        }
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
