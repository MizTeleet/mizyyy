import SwiftUI

struct DayRowView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let day: WorkDay
    let hourlyRate: Double

    private var earnings: Double {
        day.hours * hourlyRate
    }

    private var workTitle: String {
        let trimmed = day.workName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Без названия" : trimmed
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 7) {
                Text(Formatters.dayFormatter.string(from: day.date))
                    .font(.headline)
                    .foregroundStyle(themeManager.palette.primaryText)

                Text(day.isWorked ? "Работал" : "Не работал")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(day.isWorked ? themeManager.palette.positive : themeManager.palette.secondaryText)

                if day.isWorked {
                    Text(workTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(themeManager.palette.primaryText.opacity(0.88))
                        .lineLimit(1)

                    Text("\(Formatters.time(day.startTime)) - \(Formatters.time(day.endTime))")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(themeManager.palette.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            Capsule()
                                .fill(themeManager.palette.accent.opacity(0.13))
                        )
                        .overlay(
                            Capsule()
                                .stroke(themeManager.palette.accent.opacity(0.25), lineWidth: 1)
                        )
                }
            }

            Spacer(minLength: 10)

            VStack(alignment: .trailing, spacing: 8) {
                Text(day.isWorked ? "\(Formatters.hours(day.hours)) ч" : "0 ч")
                    .font(.headline.bold())
                    .foregroundStyle(day.isWorked ? themeManager.palette.accent : themeManager.palette.secondaryText)
                    .lineLimit(1)

                if day.isWorked {
                    Text("\(Formatters.money(earnings)) zł")
                        .font(.subheadline.bold())
                        .foregroundStyle(themeManager.palette.positive)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
            }
            .frame(minWidth: 84, alignment: .trailing)
        }
        .padding(18)
        .themedCard()
    }
}
