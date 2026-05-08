import SwiftUI

struct MonthCardView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager

    let month: WorkMonth

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            background

            themeManager.palette.overlay

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(viewModel.title(for: month))
                            .font(.title2.bold())
                            .foregroundStyle(themeManager.palette.primaryText)

                        Text("\(month.days.count) записей")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(themeManager.palette.secondaryText)
                    }

                    Spacer()

                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.headline)
                        .foregroundStyle(themeManager.palette.primaryText)
                        .padding(12)
                        .background(Circle().fill(.black.opacity(0.28)))
                        .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 1))
                }

                Spacer()

                HStack {
                    Label("Всего \(Formatters.hours(month.totalHours)) ч", systemImage: "clock.fill")
                        .font(.headline)
                        .foregroundStyle(themeManager.palette.accent)

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(themeManager.palette.secondaryText)
                }
            }
            .padding(20)
        }
        .frame(height: 185)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(themeManager.palette.accent.opacity(0.24), lineWidth: 1)
        )
        .shadow(color: themeManager.palette.shadow, radius: 16, x: 0, y: 12)
        .shadow(color: themeManager.palette.accent.opacity(themeManager.palette.glowOpacity), radius: 22, x: 0, y: 0)
    }

    @ViewBuilder
    private var background: some View {
        if let image = ImageStorage.shared.load(filename: month.backgroundImageFilename) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            LinearGradient(
                colors: [themeManager.palette.elevatedSurface, themeManager.palette.surface, themeManager.palette.accent.opacity(0.28)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}
