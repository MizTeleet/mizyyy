import SwiftUI

struct MainView: View {
    var body: some View {
        HomeView()
    }
}

struct HomeView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var selectedMonthForPhoto: WorkMonth?
    @State private var isShowingAddMonth = false
    @State private var appeared = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                AppBackground()

                Group {
                    if viewModel.months.isEmpty {
                        emptyState
                    } else {
                        monthsList
                    }
                }
                .animation(.easeInOut(duration: 0.35), value: viewModel.months.isEmpty)

                floatingAddButton
                    .padding(.trailing, 22)
                    .padding(.bottom, 24)
            }
            .navigationTitle("Рабочие часы")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $isShowingAddMonth) {
                AddMonthSheet()
            }
            .sheet(item: $selectedMonthForPhoto) { month in
                ImagePicker { image in
                    viewModel.setBackgroundImage(image, for: month.id)
                }
            }
            .onAppear { appeared = true }
        }
        .tint(themeManager.palette.accent)
    }

    private var monthsList: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                header

                LazyVStack(spacing: 16) {
                    ForEach(viewModel.months) { month in
                        monthCard(month)
                            .transition(.asymmetric(insertion: .scale(scale: 0.94).combined(with: .opacity), removal: .scale(scale: 0.98).combined(with: .opacity)))
                    }
                }

                SignatureView()
                    .padding(.bottom, 92)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Личный трекер")
                .font(.largeTitle.bold())
                .foregroundStyle(themeManager.palette.primaryText)

            Text("Создавайте только нужные месяцы, добавляйте рабочие дни и отслеживайте итоговые часы.")
                .font(.subheadline)
                .foregroundStyle(themeManager.palette.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 6)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 10)
        .animation(.easeInOut(duration: 0.45), value: appeared)
    }

    private func monthCard(_ month: WorkMonth) -> some View {
        ZStack(alignment: .topTrailing) {
            NavigationLink {
                MonthView(monthID: month.id)
            } label: {
                MonthCardView(month: month)
            }
            .buttonStyle(PremiumPressStyle())

            Button {
                selectedMonthForPhoto = month
            } label: {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.headline)
                    .foregroundStyle(themeManager.palette.primaryText)
                    .padding(12)
                    .background(Circle().fill(.black.opacity(0.34)))
                    .overlay(Circle().stroke(.white.opacity(0.22), lineWidth: 1))
                    .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 5)
            }
            .buttonStyle(PremiumPressStyle())
            .padding(18)
            .accessibilityLabel("Выбрать фото месяца")
        }
        .contextMenu {
            Button(role: .destructive) {
                viewModel.deleteMonth(month.id)
            } label: {
                Label("Удалить месяц", systemImage: "trash")
            }

            Button {
                viewModel.deleteBackgroundImage(for: month.id)
            } label: {
                Label("Удалить фотографию", systemImage: "photo.badge.minus")
            }
            .disabled(month.backgroundImageFilename == nil)
        }
        .scaleEffect(appeared ? 1 : 0.94)
        .opacity(appeared ? 1 : 0)
        .animation(.spring(response: 0.55, dampingFraction: 0.82), value: appeared)
    }

    private var emptyState: some View {
        VStack(spacing: 22) {
            Spacer()

            ZStack {
                Circle()
                    .fill(themeManager.palette.accent.opacity(0.18))
                    .frame(width: 118, height: 118)
                    .blur(radius: 16)

                Image(systemName: "calendar.badge.plus")
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(themeManager.palette.accent)
                    .shadow(color: themeManager.palette.accent.opacity(0.65), radius: 16, x: 0, y: 0)
            }

            VStack(spacing: 8) {
                Text("Добавьте первый месяц")
                    .font(.title2.bold())
                    .foregroundStyle(themeManager.palette.primaryText)

                Text("Нажмите +, выберите месяц и год — карточка появится на главном экране.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(themeManager.palette.secondaryText)
                    .padding(.horizontal, 36)
            }

            Button {
                isShowingAddMonth = true
            } label: {
                Label("Создать месяц", systemImage: "plus")
                    .font(.headline)
                    .foregroundStyle(Color.black)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 15)
                    .background(Capsule().fill(themeManager.palette.accent))
                    .shadow(color: themeManager.palette.accent.opacity(0.45), radius: 18, x: 0, y: 10)
            }
            .buttonStyle(PremiumPressStyle())

            Spacer()
            SignatureView()
        }
        .padding(.horizontal, 20)
        .transition(.opacity.combined(with: .scale(scale: 0.96)))
    }

    private var floatingAddButton: some View {
        Button {
            isShowingAddMonth = true
        } label: {
            Image(systemName: "plus")
                .font(.title2.bold())
                .foregroundStyle(Color.black)
                .frame(width: 62, height: 62)
                .background(Circle().fill(themeManager.palette.accent))
                .overlay(Circle().stroke(.white.opacity(0.38), lineWidth: 1))
                .shadow(color: themeManager.palette.accent.opacity(0.58), radius: 22, x: 0, y: 10)
        }
        .buttonStyle(PremiumPressStyle())
        .accessibilityLabel("Создать месяц")
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button {
                isShowingAddMonth = true
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title3)
            }
            .accessibilityLabel("Создать месяц")
        }

        ToolbarItem(placement: .navigationBarTrailing) {
            Picker("Тема", selection: $themeManager.selectedTheme.animation(.easeInOut(duration: 0.35))) {
                ForEach(AppTheme.allCases) { theme in
                    Text(theme.title).tag(theme)
                }
            }
            .pickerStyle(.menu)
        }
    }
}

struct AddMonthSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager

    @State private var selectedMonth: Int
    @State private var selectedYear: Int
    @State private var appeared = false

    private let calendar = Calendar.current

    init() {
        let now = Date()
        let calendar = Calendar.current
        _selectedMonth = State(initialValue: calendar.component(.month, from: now))
        _selectedYear = State(initialValue: calendar.component(.year, from: now))
    }

    private var years: [Int] {
        let currentYear = calendar.component(.year, from: Date())
        return Array((currentYear - 5)...(currentYear + 5))
    }

    private var canCreate: Bool {
        viewModel.canCreateMonth(year: selectedYear, month: selectedMonth)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                VStack(spacing: 22) {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Новый месяц")
                            .font(.largeTitle.bold())
                            .foregroundStyle(themeManager.palette.primaryText)

                        Text("Выберите месяц и год. Главный экран останется чистым — будут показаны только созданные вами месяцы.")
                            .font(.subheadline)
                            .foregroundStyle(themeManager.palette.secondaryText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: 14) {
                        Picker("Месяц", selection: $selectedMonth.animation(.easeInOut(duration: 0.2))) {
                            ForEach(1...12, id: \.self) { month in
                                Text(monthName(month)).tag(month)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(height: 150)

                        Picker("Год", selection: $selectedYear.animation(.easeInOut(duration: 0.2))) {
                            ForEach(years, id: \.self) { year in
                                Text(String(year)).tag(year)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(height: 120)
                    }
                    .padding(18)
                    .themedCard()

                    if !canCreate {
                        Label("Этот месяц уже создан", systemImage: "exclamationmark.triangle.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(themeManager.palette.destructive)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    Button {
                        viewModel.createMonth(year: selectedYear, month: selectedMonth)
                        dismiss()
                    } label: {
                        Text("Создать")
                            .font(.headline)
                            .foregroundStyle(Color.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(canCreate ? themeManager.palette.accent : themeManager.palette.secondaryText.opacity(0.35))
                            )
                            .shadow(color: themeManager.palette.accent.opacity(canCreate ? 0.45 : 0), radius: 18, x: 0, y: 10)
                    }
                    .buttonStyle(PremiumPressStyle())
                    .disabled(!canCreate)

                    Spacer()
                    SignatureView()
                }
                .padding(20)
                .scaleEffect(appeared ? 1 : 0.96)
                .opacity(appeared ? 1 : 0)
                .animation(.spring(response: 0.42, dampingFraction: 0.84), value: appeared)
            }
            .navigationTitle("Добавить месяц")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
            .onAppear { appeared = true }
        }
        .tint(themeManager.palette.accent)
    }

    private func monthName(_ month: Int) -> String {
        var components = DateComponents()
        components.year = selectedYear
        components.month = month
        components.day = 1

        guard let date = calendar.date(from: components) else {
            return "Месяц \(month)"
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.dateFormat = "LLLL"
        return formatter.string(from: date).capitalized
    }
}
