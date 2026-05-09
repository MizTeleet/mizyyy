import SwiftUI

struct PremiumBackground: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let animated: Bool

    init(animated: Bool = true) {
        self.animated = animated
    }

    var body: some View {
        Group {
            if animated {
                TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
                    background(elapsed: timeline.date.timeIntervalSinceReferenceDate)
                }
            } else {
                background(elapsed: 0)
            }
        }
        .animation(.easeInOut(duration: 0.28), value: themeManager.selectedTheme)
    }

    private func background(elapsed: TimeInterval) -> some View {
        let phase = elapsed / 14.0
        let slow = elapsed / 22.0

        return ZStack {
            themeManager.palette.background.ignoresSafeArea()

            LinearGradient(
                colors: gradientColors,
                startPoint: UnitPoint(x: 0.5 + 0.45 * cos(phase), y: 0.5 + 0.45 * sin(phase)),
                endPoint: UnitPoint(x: 0.5 + 0.45 * cos(phase + .pi), y: 0.5 + 0.45 * sin(phase + .pi))
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.10 : 0.24), .clear],
                center: .center,
                startRadius: 10,
                endRadius: 165
            )
            .frame(width: 300, height: 300)
            .blur(radius: 24 + 6 * abs(sin(slow)))
            .offset(x: -130 + 56 * cos(slow), y: -205 + 42 * sin(slow * 0.82))

            RadialGradient(
                colors: [Color.purple.opacity(themeManager.selectedTheme == .glass ? 0.20 : 0.12), .clear],
                center: .center,
                startRadius: 8,
                endRadius: 150
            )
            .frame(width: 280, height: 280)
            .blur(radius: 21 + 5 * abs(cos(slow * 0.9)))
            .offset(x: 130 + 42 * sin(slow * 0.78), y: 210 + 36 * cos(slow))
        }
    }

    private var gradientColors: [Color] {
        switch themeManager.selectedTheme {
        case .dark:
            return [Color.black, Color(red: 0.055, green: 0.06, blue: 0.075), Color.black]
        case .neon:
            return [
                Color(red: 0.018, green: 0.00, blue: 0.075),
                Color(red: 0.035, green: 0.02, blue: 0.13),
                Color(red: 0.00, green: 0.08, blue: 0.11),
                Color.black
            ]
        case .glass:
            return [Color(red: 0.07, green: 0.09, blue: 0.15), Color.blue.opacity(0.20), Color.purple.opacity(0.18), Color.black.opacity(0.88)]
        }
    }
}

struct AppBackground: View {
    let animated: Bool

    init(animated: Bool = true) {
        self.animated = animated
    }

    var body: some View {
        PremiumBackground(animated: animated)
    }
}

struct SignatureView: View {
    @EnvironmentObject private var themeManager: ThemeManager

    var body: some View {
        Text("Renat developer")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(themeManager.palette.secondaryText.opacity(0.46))
            .padding(.vertical, 8)
    }
}

struct ThemedCardModifier: ViewModifier {
    @EnvironmentObject private var themeManager: ThemeManager

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(themeManager.palette.surface.opacity(themeManager.selectedTheme == .glass ? 0.50 : themeManager.palette.cardOpacity))
                    .background {
                        if themeManager.selectedTheme == .glass {
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .fill(.ultraThinMaterial)
                        }
                    }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.12 : 0.26), lineWidth: 1)
            )
            .shadow(color: themeManager.palette.shadow.opacity(0.82), radius: 12, x: 0, y: 8)
            .shadow(color: themeManager.palette.accent.opacity(themeManager.palette.glowOpacity * 0.45), radius: 14, x: 0, y: 0)
            .animation(.easeInOut(duration: 0.25), value: themeManager.selectedTheme)
    }
}

struct PremiumPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? 0.035 : 0)
            .animation(.spring(response: 0.25, dampingFraction: 0.78), value: configuration.isPressed)
    }
}

extension View {
    func themedCard() -> some View {
        modifier(ThemedCardModifier())
    }
}
