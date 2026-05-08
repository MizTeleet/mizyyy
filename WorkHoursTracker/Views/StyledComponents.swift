import SwiftUI

struct PremiumBackground: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let animated: Bool
    @State private var moveGlow = false

    init(animated: Bool = true) {
        self.animated = animated
    }

    var body: some View {
        ZStack {
            themeManager.palette.background.ignoresSafeArea()

            LinearGradient(
                colors: gradientColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            glow(color: themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.08 : 0.22), size: 240)
                .offset(x: animated && moveGlow ? -110 : -155, y: animated && moveGlow ? -220 : -180)

            glow(color: Color.purple.opacity(themeManager.selectedTheme == .glass ? 0.18 : 0.10), size: 220)
                .offset(x: animated && moveGlow ? 145 : 115, y: animated && moveGlow ? 230 : 190)
        }
        .animation(animated ? .easeInOut(duration: 6).repeatForever(autoreverses: true) : nil, value: moveGlow)
        .animation(.easeInOut(duration: 0.28), value: themeManager.selectedTheme)
        .onAppear {
            guard animated else { return }
            moveGlow = true
        }
    }

    private var gradientColors: [Color] {
        switch themeManager.selectedTheme {
        case .dark:
            return [Color.black, Color(red: 0.055, green: 0.06, blue: 0.075), Color.black]
        case .neon:
            return [Color(red: 0.018, green: 0.00, blue: 0.075), Color(red: 0.035, green: 0.02, blue: 0.13), Color(red: 0.00, green: 0.08, blue: 0.11), Color.black]
        case .glass:
            return [Color(red: 0.07, green: 0.09, blue: 0.15), Color.blue.opacity(0.20), Color.purple.opacity(0.18), Color.black.opacity(0.88)]
        }
    }

    private func glow(color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .blur(radius: 38)
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
