import SwiftUI

struct MonthCardView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var shimmer = false

    let month: WorkMonth

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            background

            readabilityOverlay

            if themeManager.selectedTheme == .neon {
                LinearGradient(
                    colors: [.clear, themeManager.palette.accent.opacity(shimmer ? 0.18 : 0.04), .clear],
                    startPoint: shimmer ? .topLeading : .bottomTrailing,
                    endPoint: shimmer ? .bottomTrailing : .topLeading
                )
                .blendMode(.screen)
                .animation(.easeInOut(duration: 3.8).repeatForever(autoreverses: true), value: shimmer)
            }

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text(viewModel.title(for: month))
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.55), radius: 8, x: 0, y: 3)

                        Text("\(month.days.count) записей")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.76))
                            .shadow(color: .black.opacity(0.45), radius: 6, x: 0, y: 2)
                    }

                    Spacer(minLength: 58)
                }

                Spacer()

                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Всего часов")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.68))

                        Text("\(Formatters.hours(month.totalHours)) ч")
                            .font(.title3.bold())
                            .foregroundStyle(themeManager.palette.accent)
                            .shadow(color: themeManager.palette.accent.opacity(0.45), radius: 10, x: 0, y: 0)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.78))
                        .padding(10)
                        .background(Circle().fill(.white.opacity(0.12)))
                        .overlay(Circle().stroke(.white.opacity(0.16), lineWidth: 1))
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
                        colors: [.white.opacity(0.22), themeManager.palette.accent.opacity(0.30), .white.opacity(0.08)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: .black.opacity(0.34), radius: 18, x: 0, y: 14)
        .shadow(color: themeManager.palette.accent.opacity(themeManager.palette.glowOpacity), radius: shimmer ? 28 : 18, x: 0, y: 0)
        .animation(.easeInOut(duration: 0.35), value: themeManager.selectedTheme)
        .onAppear { shimmer = true }
    }

    @ViewBuilder
    private var background: some View {
        if let image = ImageStorage.shared.load(filename: month.backgroundImageFilename) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            LinearGradient(
                colors: [
                    themeManager.palette.elevatedSurface,
                    themeManager.palette.surface,
                    themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.18 : 0.38)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var readabilityOverlay: some View {
        ZStack {
            Color.black.opacity(month.backgroundImageFilename == nil ? 0.20 : 0.42)

            LinearGradient(
                colors: [
                    Color.black.opacity(0.78),
                    Color.black.opacity(0.42),
                    Color.black.opacity(0.70)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            LinearGradient(
                colors: [.clear, Color.black.opacity(0.76)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}
