import SwiftUI

@MainActor
final class WorkHoursViewModel: ObservableObject {
    @Published private(set) var months: [WorkMonth] = []

    private let store: WorkDataStore
    private let calendar: Calendar

    init(store: WorkDataStore = .shared, calendar: Calendar = .current) {
        self.store = store
        self.calendar = calendar
        months = store.loadMonths()
    }

    func title(for month: WorkMonth) -> String {
        var components = DateComponents()
        components.year = month.year
        components.month = month.month
        components.day = 1

        guard let date = calendar.date(from: components) else {
            return "Месяц \(month.month) \(month.year)"
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: date).capitalized
    }

    func month(with id: WorkMonth.ID) -> WorkMonth? {
        months.first { $0.id == id }
    }

    func days(for monthID: WorkMonth.ID) -> [WorkDay] {
        month(with: monthID)?.days.sorted { $0.date < $1.date } ?? []
    }

    func totalHours(for monthID: WorkMonth.ID) -> Double {
        month(with: monthID)?.totalHours ?? 0
    }

    func dateRange(for month: WorkMonth) -> ClosedRange<Date> {
        var startComponents = DateComponents()
        startComponents.year = month.year
        startComponents.month = month.month
        startComponents.day = 1

        let start = calendar.date(from: startComponents) ?? Date()
        let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? start
        return start...end
    }

    func saveDay(_ day: WorkDay, in monthID: WorkMonth.ID) {
        guard let monthIndex = months.firstIndex(where: { $0.id == monthID }) else { return }
        var updatedDay = day
        updatedDay.date = calendar.startOfDay(for: day.date)

        if let dayIndex = months[monthIndex].days.firstIndex(where: { $0.id == day.id }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                months[monthIndex].days[dayIndex] = updatedDay
            }
        } else {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                months[monthIndex].days.append(updatedDay)
            }
        }
        persist()
    }

    func deleteDays(at offsets: IndexSet, from monthID: WorkMonth.ID) {
        guard let monthIndex = months.firstIndex(where: { $0.id == monthID }) else { return }
        let sortedDays = days(for: monthID)
        let idsToDelete = offsets.map { sortedDays[$0].id }

        withAnimation(.easeInOut(duration: 0.22)) {
            months[monthIndex].days.removeAll { idsToDelete.contains($0.id) }
        }
        persist()
    }

    func setBackgroundImage(_ image: UIImage, for monthID: WorkMonth.ID) {
        guard let index = months.firstIndex(where: { $0.id == monthID }) else { return }
        let oldFilename = months[index].backgroundImageFilename
        guard let filename = ImageStorage.shared.save(image, previousFilename: oldFilename) else { return }

        withAnimation(.easeInOut(duration: 0.28)) {
            months[index].backgroundImageFilename = filename
        }
        persist()
    }

    private func persist() {
        store.save(months: months)
    }
}
