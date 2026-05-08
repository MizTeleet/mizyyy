import SwiftUI

struct MainView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var selectedMonthForPhoto: WorkMonth?
    @State private var appeared = false

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        header

                        LazyVStack(spacing: 16) {
                            ForEach(viewModel.months) { month in
                                ZStack(alignment: .topTrailing) {
                                    NavigationLink {
                                        MonthView(monthID: month.id)
                                    } label: {
                                        MonthCardView(month: month)
                                    }
                                    .buttonStyle(.plain)

                                    Button {
                                        selectedMonthForPhoto = month
                                    } label: {
                                        Image(systemName: "photo.on.rectangle.angled")
                                            .font(.headline)
                                            .foregroundStyle(themeManager.palette.primaryText)
                                            .padding(12)
                                            .background(Circle().fill(.black.opacity(0.28)))
                                            .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                    .padding(20)
                                    .accessibilityLabel("Изменить фото месяца")
                                }
                                .scaleEffect(appeared ? 1 : 0.96)
                                .opacity(appeared ? 1 : 0)
                                .animation(.spring(response: 0.45, dampingFraction: 0.86).delay(0.03), value: appeared)
                            }
                        }

                        SignatureView()
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 14)
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle("Рабочие часы")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { themePicker }
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(item: $selectedMonthForPhoto) { month in
                ImagePicker { image in
                    viewModel.setBackgroundImage(image, for: month.id)
                }
            }
            .onAppear { appeared = true }
        }
        .tint(themeManager.palette.accent)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Личный трекер")
                .font(.largeTitle.bold())
                .foregroundStyle(themeManager.palette.primaryText)

            Text("Выберите месяц, добавляйте рабочие дни и следите за суммой часов.")
                .font(.subheadline)
                .foregroundStyle(themeManager.palette.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 6)
    }

    private var themePicker: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Picker("Тема", selection: $themeManager.selectedTheme.animation(.easeInOut(duration: 0.25))) {
                ForEach(AppTheme.allCases) { theme in
                    Text(theme.title).tag(theme)
                }
            }
            .pickerStyle(.menu)
        }
    }
}
