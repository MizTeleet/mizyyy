import SwiftUI

struct MonthView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var editingDay: WorkDay?
    @State private var isAddingDay = false
    @State private var addButtonPressed = false
    @State private var appeared = false
    @State private var isEditingRate = false

    let monthID: WorkMonth.ID

    private var month: WorkMonth? {
        viewModel.month(with: monthID)
    }

    private var days: [WorkDay] {
        viewModel.days(for: monthID)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            AppBackground()

            VStack(spacing: 0) {
                if let month {
                    List {
                        Section {
                            ForEach(days) { day in
                                DayRowView(day: day)
                                    .listRowInsets(EdgeInsets(top: 7, leading: 16, bottom: 7, trailing: 16))
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .onTapGesture {
                                        editingDay = day
                                    }
                                    .transition(.asymmetric(insertion: .scale.combined(with: .opacity), removal: .opacity))
                            }
                            .onDelete { offsets in
                                viewModel.deleteDays(at: offsets, from: monthID)
                            }
                        } header: {
                            monthHeader(month)
                                .listRowInsets(EdgeInsets())
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)

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
            .offset(y: appeared ? 0 : 12)
            .animation(.easeInOut(duration: 0.28), value: appeared)

            if month != nil {
                addButton
                    .padding(.trailing, 22)
                    .padding(.bottom, 88)
            }
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

    private func monthHeader(_ month: WorkMonth) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(viewModel.title(for: month))
                .font(.largeTitle.bold())
                .textCase(nil)
                .foregroundStyle(themeManager.palette.primaryText)

            Text("Свайпните запись влево, чтобы удалить её. Нажмите на день для редактирования.")
                .font(.subheadline)
                .textCase(nil)
                .foregroundStyle(themeManager.palette.secondaryText)

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
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    private var totalBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Всего:")
                    .font(.headline)
                    .foregroundStyle(themeManager.palette.secondaryText)

                Text("\(Formatters.hours(viewModel.totalHours(for: monthID))) часов")
                    .font(.title3.bold())
                    .foregroundStyle(themeManager.palette.primaryText)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.totalHours(for: monthID))

                Spacer()
            }

            HStack {
                Text("Заработал:")
                    .font(.headline)
                    .foregroundStyle(themeManager.palette.secondaryText)

                Text(Formatters.money(viewModel.totalEarnings(for: monthID)))
                    .font(.title3.bold())
                    .foregroundStyle(themeManager.palette.accent)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.totalEarnings(for: monthID))

                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(totalBarBackground)
    }

    @ViewBuilder
    private var totalBarBackground: some View {
        if themeManager.selectedTheme == .glass {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        } else {
            Rectangle()
                .fill(themeManager.palette.elevatedSurface)
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private var addButton: some View {
        Button {
            withAnimation(.spring(response: 0.24, dampingFraction: 0.55)) {
                addButtonPressed = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                addButtonPressed = false
                isAddingDay = true
            }
        } label: {
            Image(systemName: "plus")
                .font(.title2.bold())
                .foregroundStyle(Color.black)
                .frame(width: 62, height: 62)
                .background(Circle().fill(themeManager.palette.accent))
                .shadow(color: themeManager.palette.accent.opacity(0.52), radius: 18, x: 0, y: 8)
        }
        .buttonStyle(PremiumPressStyle())
        .scaleEffect(addButtonPressed ? 0.88 : 1)
        .rotationEffect(.degrees(addButtonPressed ? 90 : 0))
        .animation(.spring(response: 0.25, dampingFraction: 0.55), value: addButtonPressed)
        .accessibilityLabel("Добавить день")
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
