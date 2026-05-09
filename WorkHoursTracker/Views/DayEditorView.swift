import SwiftUI

struct DayEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager

    let month: WorkMonth
    let isNew: Bool
    let onSave: (WorkDay) -> Void

    @State private var selectedDay: Int
    @State private var isWorked: Bool
    @State private var workName: String
    @State private var startTime: Date
    @State private var endTime: Date
    @State private var formAppeared = false

    private let dayID: UUID
    private let calendar = Calendar.current

    init(month: WorkMonth, day: WorkDay, isNew: Bool, onSave: @escaping (WorkDay) -> Void) {
        self.month = month
        self.isNew = isNew
        self.onSave = onSave
        self.dayID = day.id
        let calendar = Calendar.current
        _selectedDay = State(initialValue: calendar.component(.day, from: day.date))
        _isWorked = State(initialValue: day.isWorked)
        _workName = State(initialValue: day.workName)
        _startTime = State(initialValue: day.startTime)
        _endTime = State(initialValue: day.endTime)
    }

    private var daysInMonth: Int {
        var components = DateComponents()
        components.year = month.year
        components.month = month.month
        guard let date = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: date) else {
            return 31
        }
        return range.count
    }

    private var selectedDate: Date {
        var components = DateComponents()
        components.year = month.year
        components.month = month.month
        components.day = min(selectedDay, daysInMonth)
        return calendar.date(from: components) ?? Date()
    }

    private var calculatedHours: Double {
        guard isWorked else { return 0 }
        let start = combinedDate(withTimeFrom: startTime)
        var end = combinedDate(withTimeFrom: endTime)
        if end < start {
            end = calendar.date(byAdding: .day, value: 1, to: end) ?? end
        }
        return max(end.timeIntervalSince(start) / 3600, 0)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground(animated: false)

                VStack(spacing: 18) {
                    VStack(spacing: 18) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("День")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(themeManager.palette.secondaryText)

                            Picker("День", selection: $selectedDay.animation(.easeInOut(duration: 0.18))) {
                                ForEach(1...daysInMonth, id: \.self) { day in
                                    Text("\(day)")
                                        .font(.title3.weight(.semibold))
                                        .tag(day)
                                }
                            }
                            .pickerStyle(.wheel)
                            .frame(height: 118)
                            .clipped()
                        }

                        Toggle("Работал", isOn: $isWorked.animation(.spring(response: 0.30, dampingFraction: 0.84)))
                            .tint(themeManager.palette.accent)

                        if isWorked {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Название смены")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(themeManager.palette.secondaryText)

                                TextField("Склад 1, Amazon, Night Shift", text: $workName)
                                    .textFieldStyle(.plain)
                                    .font(.headline)
                                    .foregroundStyle(themeManager.palette.primaryText)
                                    .padding(14)
                                    .background(
                                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .fill(themeManager.palette.elevatedSurface.opacity(0.72))
                                    )
                            }
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        if isWorked {
                            VStack(spacing: 16) {
                                TimeWheelPicker(title: "Начал работу", selection: $startTime)
                                TimeWheelPicker(title: "Закончил работу", selection: $endTime)

                                HStack {
                                    Text("Количество часов")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(themeManager.palette.secondaryText)

                                    Spacer()

                                    Text("\(Formatters.hours(calculatedHours)) ч")
                                        .font(.title3.bold())
                                        .foregroundStyle(themeManager.palette.accent)
                                        .animation(.easeInOut(duration: 0.20), value: calculatedHours)
                                }
                                .padding(16)
                                .background(
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .fill(themeManager.palette.elevatedSurface.opacity(0.78))
                                )
                            }
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }
                    }
                    .padding(20)
                    .themedCard()
                    .padding(.horizontal, 18)
                    .scaleEffect(formAppeared ? 1 : 0.98)
                    .opacity(formAppeared ? 1 : 0)

                    Spacer()

                    SignatureView()
                }
                .padding(.top, 18)
            }
            .navigationTitle(isNew ? "Добавить день" : "Редактировать")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Сохранить") { save() }
                        .disabled(isWorked && calculatedHours <= 0)
                }
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 0.18)) {
                    formAppeared = true
                }
            }
        }
        .tint(themeManager.palette.accent)
    }

    private func combinedDate(withTimeFrom time: Date) -> Date {
        let timeComponents = calendar.dateComponents([.hour, .minute], from: time)
        var components = calendar.dateComponents([.year, .month, .day], from: selectedDate)
        components.hour = timeComponents.hour
        components.minute = timeComponents.minute
        return calendar.date(from: components) ?? selectedDate
    }

    private func save() {
        let day = WorkDay(
            id: dayID,
            date: selectedDate,
            isWorked: isWorked,
            workName: workName.trimmingCharacters(in: .whitespacesAndNewlines),
            startTime: combinedDate(withTimeFrom: startTime),
            endTime: combinedDate(withTimeFrom: endTime)
        )
        onSave(day)
        dismiss()
    }
}

private struct TimeWheelPicker: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let title: String
    @Binding var selection: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(themeManager.palette.secondaryText)

            DatePicker(title, selection: $selection, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .frame(height: 104)
                .clipped()
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(themeManager.palette.elevatedSurface.opacity(0.58))
                )
        }
    }
}
