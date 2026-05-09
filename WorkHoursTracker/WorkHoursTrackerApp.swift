import SwiftUI

@main
struct WorkHoursTrackerApp: App {
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var viewModel = WorkHoursViewModel()

    var body: some Scene {
        WindowGroup {
            MainView()
                .environmentObject(themeManager)
                .environmentObject(viewModel)
                .preferredColorScheme(.dark)
        }
    }
}
