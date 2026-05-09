import SwiftUI

struct MonthView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var editingDay: WorkDay?
    @State private var isAddingDay = false
    @State private var addButtonPressed = false
    @State private var appeared = false
    @State private var isEditingRate = false
    @State private var headerCollapse: CGFloat = 0

    let monthID: WorkMonth.ID

    private var month: WorkMonth? {
        viewModel.month(with: monthID)
    }

    private var days: [WorkDay] {
        viewModel.days(for: monthID)
    }

    var body: some View {
        ZStack {
            AppBackground()

            VStack(spacing: 0) {
                if let month {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 14) {
                            scrollOffsetReader

                            monthHeader(month)
                                .opacity(1 - headerCollapse)
                                .offset(y: -34 * headerCollapse)
                                .scaleEffect(1 - 0.025 * headerCollapse, anchor: .topLeading)
                                .animation(.easeInOut(duration: 0.18), value: headerCollapse)

                            ForEach(days) { day in
                                DayRowView(day: day, hourlyRate: month.hourlyRate)
                                    .onTapGesture {
                                        editingDay = day
                                    }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            viewModel.deleteDay(day.id, from: monthID)
                                        } label: {
                                            Label("Удалить", systemImage: "trash")
                                        }
                                    }
                                    .contextMenu {
                                        Button(role: .destructive) {
                                            viewModel.deleteDay(day.id, from: monthID)
                                        } label: {
                                            Label("Удалить", systemImage: "trash")
                                        }
                                    }
                                    .padding(.horizontal, 16)
                                    .transition(.asymmetric(insertion: .scale(scale: 0.98).combined(with: .opacity), removal: .opacity))
                            }
                        }
                        .padding(.top, 12)
                        .padding(.bottom, 22)
                    }
                    .coordinateSpace(name: "monthScroll")
                    .onPreferenceChange(MonthScrollOffsetPreferenceKey.self) { value in
                        let collapse = min(max(-value / 120, 0), 1)
                        if abs(headerCollapse - collapse) > 0.01 {
                            headerCollapse = collapse
                        }
                    }

                    totalBar
                } else {
                    VStack(spacing: 14) {
                        Image(systemName: "calendar.badge.exclamationmark")
                            .font(.system(size: 48, weight: .semibold))
                        Text("Месяц не найден")
                            .font(.title3.bold())
                    }
                    .foregroundStyle(themeManager.palette.secondaryText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 10)
            .animation(.spring(response: 0.34, dampingFraction: 0.88), value: appeared)
        }
        .navigationTitle(month.map { viewModel.title(for: $0) } ?? "Месяц")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(isPresented: $isAddingDay) {
            if let month {
                DayEditorView(
                    month: month,
                    day: WorkDay(date: viewModel.dateRange(for: month).lowerBound),
                    isNew: true
                ) { day in
                    viewModel.saveDay(day, in: monthID)
                }
            }
        }
        .sheet(item: $editingDay) { day in
            if let month {
                DayEditorView(month: month, day: day, isNew: false) { updatedDay in
                    viewModel.saveDay(updatedDay, in: monthID)
                }
            }
        }
        .sheet(isPresented: $isEditingRate) {
            if let month {
                RateEditorSheet(month: month) { newRate in
                    viewModel.updateHourlyRate(newRate, for: monthID)
                }
            }
        }
        .onAppear { appeared = true }
    }

    private var scrollOffsetReader: some View {
        GeometryReader { proxy in
            Color.clear
                .preference(key: MonthScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("monthScroll")).minY)
        }
        .frame(height: 0)
    }

    private func monthHeader(_ month: WorkMonth) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(viewModel.title(for: month))
                .font(.largeTitle.bold())
                .foregroundStyle(themeManager.palette.primaryText)

            HStack(spacing: 10) {
                Text("Ставка: \(Formatters.rate(month.hourlyRate))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.palette.accent)

                Button("Изменить ставку") {
                    isEditingRate = true
                }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.bordered)
                .tint(themeManager.palette.accent)
            }

            Text("Прокрутите список: заголовок плавно скрывается. Нажмите на день для редактирования.")
                .font(.subheadline)
                .foregroundStyle(themeManager.palette.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private var totalBar: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Text("Всего часов")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(themeManager.palette.secondaryText)

                    Text("\(Formatters.hours(viewModel.totalHours(for: monthID)))")
                        .font(.headline.bold())
                        .foregroundStyle(themeManager.palette.primaryText)
                        .animation(.easeInOut(duration: 0.22), value: viewModel.totalHours(for: monthID))
                }

                HStack(spacing: 6) {
                    Text("Заработал")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(themeManager.palette.secondaryText)

                    Text("\(Formatters.money(viewModel.totalEarnings(for: monthID))) zł")
                        .font(.headline.bold())
                        .foregroundStyle(themeManager.palette.positive)
                        .animation(.easeInOut(duration: 0.22), value: viewModel.totalEarnings(for: monthID))
                }
            }

            Spacer(minLength: 10)

            addButton
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(totalBarBackground)
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    private var totalBarBackground: some View {
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(themeManager.palette.elevatedSurface.opacity(0.48))
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(themeManager.palette.accent.opacity(0.28), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.30), radius: 16, x: 0, y: 10)
            .shadow(color: themeManager.palette.accent.opacity(0.18), radius: 18, x: 0, y: 0)
    }

    private var addButton: some View {
        Button {
            withAnimation(.spring(response: 0.24, dampingFraction: 0.62)) {
                addButtonPressed = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.10) {
                addButtonPressed = false
                isAddingDay = true
            }
        } label: {
            Image(systemName: "plus")
                .font(.title3.bold())
                .foregroundStyle(Color.black)
                .frame(width: 50, height: 50)
                .background(Circle().fill(themeManager.palette.accent))
                .overlay(Circle().stroke(.white.opacity(0.35), lineWidth: 1))
                .shadow(color: themeManager.palette.accent.opacity(0.38), radius: 12, x: 0, y: 6)
        }
        .buttonStyle(PremiumPressStyle())
        .scaleEffect(addButtonPressed ? 0.90 : 1)
        .rotationEffect(.degrees(addButtonPressed ? 90 : 0))
        .animation(.spring(response: 0.24, dampingFraction: 0.62), value: addButtonPressed)
        .accessibilityLabel("Добавить день")
    }
}

private struct MonthScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct RateEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager

    let month: WorkMonth
    let onSave: (Double) -> Void

    @State private var rateText: String

    init(month: WorkMonth, onSave: @escaping (Double) -> Void) {
        self.month = month
        self.onSave = onSave
        _rateText = State(initialValue: Formatters.rate(month.hourlyRate))
    }

    private var rate: Double {
        Double(rateText.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private var canSave: Bool {
        rate > 0
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground(animated: false)

                VStack(alignment: .leading, spacing: 18) {
                    Text("Новая ставка за час")
                        .font(.title2.bold())
                        .foregroundStyle(themeManager.palette.primaryText)

                    TextField("31.4", text: $rateText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.plain)
                        .font(.title3.bold())
                        .foregroundStyle(themeManager.palette.primaryText)
                        .padding(16)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(themeManager.palette.elevatedSurface.opacity(0.82))
                        )

                    Text("Текущая ставка: \(Formatters.rate(month.hourlyRate))")
                        .font(.subheadline)
                        .foregroundStyle(themeManager.palette.secondaryText)

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Изменить ставку")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Сохранить") {
                        onSave(rate)
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
        .tint(themeManager.palette.accent)
    }
}
