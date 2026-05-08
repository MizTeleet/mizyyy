import SwiftUI

struct MonthCardView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager

    let month: WorkMonth

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            cardBackground
            readabilityOverlay

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text(viewModel.title(for: month))
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.45), radius: 6, x: 0, y: 2)

                        Text("\(month.days.count) записей")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.74))
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.78))
                        .padding(10)
                        .background(Circle().fill(.white.opacity(0.10)))
                        .overlay(Circle().stroke(.white.opacity(0.14), lineWidth: 1))
                }

                Spacer()

                HStack(alignment: .bottom, spacing: 14) {
                    metric(title: "Всего", value: "\(Formatters.hours(month.totalHours)) ч")
                    metric(title: "Ставка", value: Formatters.rate(month.hourlyRate))
                    metric(title: "Заработал", value: Formatters.money(month.totalEarnings), accent: true)
                }
            }
            .padding(20)
        }
        .frame(height: 190)
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.18), themeManager.palette.accent.opacity(0.26), .white.opacity(0.06)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: .black.opacity(0.30), radius: 14, x: 0, y: 10)
        .shadow(color: themeManager.palette.accent.opacity(themeManager.palette.glowOpacity * 0.45), radius: 14, x: 0, y: 0)
        .animation(.easeInOut(duration: 0.25), value: themeManager.selectedTheme)
    }

    private var cardBackground: some View {
        LinearGradient(
            colors: [
                themeManager.palette.elevatedSurface,
                themeManager.palette.surface,
                themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.14 : 0.30)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var readabilityOverlay: some View {
        ZStack {
            Color.black.opacity(0.18)

            LinearGradient(
                colors: [Color.black.opacity(0.68), Color.black.opacity(0.26), Color.black.opacity(0.62)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private func metric(title: String, value: String, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.62))

            Text(value)
                .font(.headline.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .foregroundStyle(accent ? themeManager.palette.accent : .white)
                .shadow(color: accent ? themeManager.palette.accent.opacity(0.35) : .clear, radius: 8, x: 0, y: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
