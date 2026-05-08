import SwiftUI

struct MainView: View {
    var body: some View {
        HomeView()
    }
}

struct HomeView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
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
                .animation(.easeInOut(duration: 0.25), value: viewModel.months.isEmpty)

                floatingAddButton
                    .padding(.trailing, 22)
                    .padding(.bottom, 24)
            }
            .navigationTitle("Рабочие часы")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { themePicker }
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $isShowingAddMonth) {
                AddMonthSheet()
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
                        NavigationLink {
                            MonthView(monthID: month.id)
                        } label: {
                            MonthCardView(month: month)
                        }
                        .buttonStyle(PremiumPressStyle())
                        .contextMenu {
                            Button(role: .destructive) {
                                viewModel.deleteMonth(month.id)
                            } label: {
                                Label("Удалить месяц", systemImage: "trash")
                            }
                        }
                        .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity), removal: .opacity))
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

            Text("Создавайте месяцы, задавайте ставку и отслеживайте часы с заработком.")
                .font(.subheadline)
                .foregroundStyle(themeManager.palette.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 6)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 8)
        .animation(.easeInOut(duration: 0.30), value: appeared)
    }

    private var emptyState: some View {
        VStack(spacing: 22) {
            Spacer()

            ZStack {
                Circle()
                    .fill(themeManager.palette.accent.opacity(0.14))
                    .frame(width: 112, height: 112)
                    .blur(radius: 12)

                Image(systemName: "calendar.badge.plus")
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(themeManager.palette.accent)
                    .shadow(color: themeManager.palette.accent.opacity(0.42), radius: 10, x: 0, y: 0)
            }

            VStack(spacing: 8) {
                Text("Добавьте первый месяц")
                    .font(.title2.bold())
                    .foregroundStyle(themeManager.palette.primaryText)

                Text("Нажмите +, выберите месяц, год и ставку за час.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(themeManager.palette.secondaryText)
                    .padding(.horizontal, 36)
            }

            Spacer()
            SignatureView()
        }
        .padding(.horizontal, 20)
        .transition(.opacity.combined(with: .scale(scale: 0.98)))
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
                .overlay(Circle().stroke(.white.opacity(0.30), lineWidth: 1))
                .shadow(color: themeManager.palette.accent.opacity(0.36), radius: 14, x: 0, y: 8)
        }
        .buttonStyle(PremiumPressStyle())
        .accessibilityLabel("Создать месяц")
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

struct AddMonthSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager

    @State private var selectedMonth: Int
    @State private var selectedYear: Int
    @State private var hourlyRateText = ""
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

    private var hourlyRate: Double {
        Double(hourlyRateText.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private var canCreate: Bool {
        hourlyRate > 0 && viewModel.canCreateMonth(year: selectedYear, month: selectedMonth)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground(animated: false)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Новый месяц")
                                .font(.largeTitle.bold())
                                .foregroundStyle(themeManager.palette.primaryText)

                            Text("Выберите месяц, год и ставку за час.")
                                .font(.subheadline)
                                .foregroundStyle(themeManager.palette.secondaryText)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        VStack(spacing: 18) {
                            HStack(spacing: 14) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Месяц")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(themeManager.palette.secondaryText)

                                    Picker("Месяц", selection: $selectedMonth.animation(.easeInOut(duration: 0.18))) {
                                        ForEach(1...12, id: \.self) { month in
                                            Text(monthName(month)).tag(month)
                                        }
                                    }
                                    .pickerStyle(.wheel)
                                    .frame(height: 142)
                                    .clipped()
                                }

                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Год")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(themeManager.palette.secondaryText)

                                    Picker("Год", selection: $selectedYear.animation(.easeInOut(duration: 0.18))) {
                                        ForEach(years, id: \.self) { year in
                                            Text(String(year)).tag(year)
                                        }
                                    }
                                    .pickerStyle(.wheel)
                                    .frame(height: 142)
                                    .clipped()
                                }
                            }

                            VStack(alignment: .leading, spacing: 8) {
                                Text("Ставка за час")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(themeManager.palette.secondaryText)

                                TextField("31.4", text: $hourlyRateText)
                                    .keyboardType(.decimalPad)
                                    .textFieldStyle(.plain)
                                    .font(.title3.bold())
                                    .foregroundStyle(themeManager.palette.primaryText)
                                    .padding(16)
                                    .background(
                                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .fill(themeManager.palette.elevatedSurface.opacity(0.82))
                                    )
                            }
                        }
                        .padding(18)
                        .themedCard()

                        if !viewModel.canCreateMonth(year: selectedYear, month: selectedMonth) {
                            Label("Этот месяц уже создан", systemImage: "exclamationmark.triangle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(themeManager.palette.destructive)
                                .transition(.opacity)
                        } else if !hourlyRateText.isEmpty && hourlyRate <= 0 {
                            Label("Введите ставку больше 0", systemImage: "exclamationmark.triangle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(themeManager.palette.destructive)
                                .transition(.opacity)
                        }

                        Button {
                            viewModel.createMonth(year: selectedYear, month: selectedMonth, hourlyRate: hourlyRate)
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
                                .shadow(color: themeManager.palette.accent.opacity(canCreate ? 0.26 : 0), radius: 10, x: 0, y: 6)
                        }
                        .buttonStyle(PremiumPressStyle())
                        .disabled(!canCreate)

                        SignatureView()
                    }
                    .padding(20)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 8)
                    .animation(.easeInOut(duration: 0.20), value: appeared)
                }
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
