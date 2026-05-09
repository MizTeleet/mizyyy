import SwiftUI

final class ThemeManager: ObservableObject {
    @Published var selectedTheme: AppTheme {
        didSet {
            UserDefaults.standard.set(selectedTheme.rawValue, forKey: storageKey)
        }
    }

    private let storageKey = "selected_app_theme"

    init() {
        if let rawValue = UserDefaults.standard.string(forKey: storageKey),
           let storedTheme = AppTheme(rawValue: rawValue) {
            selectedTheme = storedTheme
        } else {
            selectedTheme = .dark
        }
    }

    var palette: ThemePalette {
        selectedTheme.palette
    }
}
