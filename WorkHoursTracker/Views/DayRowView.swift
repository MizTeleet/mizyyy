import SwiftUI

struct DayRowView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let day: WorkDay

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(Formatters.dayFormatter.string(from: day.date))
                    .font(.headline)
                    .foregroundStyle(themeManager.palette.primaryText)

                Text(day.isWorked ? "Работал" : "Не работал")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(day.isWorked ? themeManager.palette.positive : themeManager.palette.secondaryText)
            }

            Spacer()

            Text(day.isWorked ? "\(Formatters.hours(day.hours)) ч" : "Не работал")
                .font(.headline.bold())
                .foregroundStyle(day.isWorked ? themeManager.palette.accent : themeManager.palette.secondaryText)
        }
        .padding(18)
        .themedCard()
    }
}
