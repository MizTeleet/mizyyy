import SwiftUI

enum AppTheme: String, CaseIterable, Identifiable, Codable {
    case dark
    case neon
    case glass

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dark: return "Dark"
        case .neon: return "Neon"
        case .glass: return "Glass"
        }
    }

    var palette: ThemePalette {
        switch self {
        case .dark:
            return ThemePalette(
                background: Color.black,
                surface: Color(red: 0.08, green: 0.08, blue: 0.09),
                elevatedSurface: Color(red: 0.12, green: 0.12, blue: 0.14),
                primaryText: Color.white,
                secondaryText: Color.white.opacity(0.66),
                accent: Color(red: 0.88, green: 0.88, blue: 0.9),
                positive: Color(red: 0.40, green: 0.86, blue: 0.58),
                destructive: Color(red: 1.0, green: 0.35, blue: 0.35),
                shadow: Color.black.opacity(0.55),
                overlay: Color.black.opacity(0.48),
                cardOpacity: 1,
                glowOpacity: 0,
                blurRadius: 0
            )
        case .neon:
            return ThemePalette(
                background: Color(red: 0.02, green: 0.00, blue: 0.08),
                surface: Color(red: 0.08, green: 0.03, blue: 0.17),
                elevatedSurface: Color(red: 0.10, green: 0.04, blue: 0.24),
                primaryText: Color.white,
                secondaryText: Color(red: 0.76, green: 0.86, blue: 1.0),
                accent: Color(red: 0.00, green: 0.95, blue: 1.0),
                positive: Color(red: 0.35, green: 1.0, blue: 0.56),
                destructive: Color(red: 1.0, green: 0.10, blue: 0.52),
                shadow: Color(red: 0.00, green: 0.88, blue: 1.0).opacity(0.42),
                overlay: Color.black.opacity(0.50),
                cardOpacity: 1,
                glowOpacity: 0.88,
                blurRadius: 0
            )
        case .glass:
            return ThemePalette(
                background: Color(red: 0.08, green: 0.10, blue: 0.16),
                surface: Color.white.opacity(0.16),
                elevatedSurface: Color.white.opacity(0.22),
                primaryText: Color.white,
                secondaryText: Color.white.opacity(0.72),
                accent: Color(red: 0.72, green: 0.84, blue: 1.0),
                positive: Color(red: 0.58, green: 0.95, blue: 0.76),
                destructive: Color(red: 1.0, green: 0.48, blue: 0.58),
                shadow: Color.black.opacity(0.26),
                overlay: Color.black.opacity(0.36),
                cardOpacity: 0.62,
                glowOpacity: 0.18,
                blurRadius: 18
            )
        }
    }
}

struct ThemePalette {
    let background: Color
    let surface: Color
    let elevatedSurface: Color
    let primaryText: Color
    let secondaryText: Color
    let accent: Color
    let positive: Color
    let destructive: Color
    let shadow: Color
    let overlay: Color
    let cardOpacity: Double
    let glowOpacity: Double
    let blurRadius: CGFloat
}
