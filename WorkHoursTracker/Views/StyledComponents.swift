import SwiftUI

struct AppBackground: View {
    @EnvironmentObject private var themeManager: ThemeManager

    var body: some View {
        ZStack {
            themeManager.palette.background.ignoresSafeArea()

            if themeManager.selectedTheme == .neon {
                Circle()
                    .fill(themeManager.palette.accent.opacity(0.30))
                    .frame(width: 280, height: 280)
                    .blur(radius: 70)
                    .offset(x: -150, y: -260)

                Circle()
                    .fill(Color.pink.opacity(0.26))
                    .frame(width: 260, height: 260)
                    .blur(radius: 80)
                    .offset(x: 160, y: 240)
            }

            if themeManager.selectedTheme == .glass {
                LinearGradient(
                    colors: [Color.blue.opacity(0.35), Color.purple.opacity(0.25), Color.black.opacity(0.25)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            }
        }
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
                        }
                    }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(themeManager.palette.accent.opacity(themeManager.selectedTheme == .dark ? 0.10 : 0.35), lineWidth: 1)
            )
            .shadow(color: themeManager.palette.shadow, radius: themeManager.selectedTheme == .neon ? 18 : 14, x: 0, y: 10)
            .shadow(color: themeManager.palette.accent.opacity(themeManager.palette.glowOpacity), radius: 20, x: 0, y: 0)
    }
}

extension View {
    func themedCard() -> some View {
        modifier(ThemedCardModifier())
    }
}
