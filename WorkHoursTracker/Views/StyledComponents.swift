import SwiftUI

struct AnimatedGradientBackground: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var animate = false

    var body: some View {
        ZStack {
            themeManager.palette.background.ignoresSafeArea()

            LinearGradient(
                colors: gradientColors,
                startPoint: animate ? .topLeading : .bottomLeading,
                endPoint: animate ? .bottomTrailing : .topTrailing
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 8).repeatForever(autoreverses: true), value: animate)

            glowBlob(color: themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.10 : 0.34), size: 340)
                .offset(x: animate ? -130 : -210, y: animate ? -250 : -160)

            glowBlob(color: Color.pink.opacity(themeManager.selectedTheme == .neon ? 0.30 : 0.14), size: 300)
                .offset(x: animate ? 190 : 130, y: animate ? 260 : 170)

            glowBlob(color: Color.purple.opacity(themeManager.selectedTheme == .glass ? 0.28 : 0.16), size: 260)
                .offset(x: animate ? 80 : -40, y: animate ? -30 : 80)
        }
        .animation(.easeInOut(duration: 0.45), value: themeManager.selectedTheme)
        .onAppear { animate = true }
    }

    private var gradientColors: [Color] {
        switch themeManager.selectedTheme {
        case .dark:
            return [Color.black, Color(red: 0.08, green: 0.08, blue: 0.10), Color.black]
        case .neon:
            return [Color(red: 0.02, green: 0.00, blue: 0.10), Color(red: 0.08, green: 0.02, blue: 0.22), Color(red: 0.00, green: 0.13, blue: 0.18), Color.black]
        case .glass:
            return [Color(red: 0.08, green: 0.10, blue: 0.18), Color.blue.opacity(0.38), Color.purple.opacity(0.30), Color.black.opacity(0.75)]
        }
    }

    private func glowBlob(color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .blur(radius: size * 0.22)
            .animation(.easeInOut(duration: 7).repeatForever(autoreverses: true), value: animate)
    }
}

struct AppBackground: View {
    var body: some View {
        AnimatedGradientBackground()
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
                    .fill(themeManager.palette.surface.opacity(themeManager.palette.cardOpacity))
                    .background {
                        if themeManager.selectedTheme == .glass {
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .fill(.ultraThinMaterial)
                                .blur(radius: 0.4)
                        }
                    }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [themeManager.palette.accent.opacity(0.42), Color.white.opacity(0.10), themeManager.palette.accent.opacity(0.18)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: themeManager.palette.shadow, radius: themeManager.selectedTheme == .neon ? 22 : 16, x: 0, y: 14)
            .shadow(color: themeManager.palette.accent.opacity(themeManager.palette.glowOpacity), radius: 24, x: 0, y: 0)
            .animation(.easeInOut(duration: 0.35), value: themeManager.selectedTheme)
    }
}

struct PremiumPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.965 : 1)
            .brightness(configuration.isPressed ? 0.04 : 0)
            .animation(.spring(response: 0.28, dampingFraction: 0.72), value: configuration.isPressed)
    }
}

extension View {
    func themedCard() -> some View {
        modifier(ThemedCardModifier())
    }
}
