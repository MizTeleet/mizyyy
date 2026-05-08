import SwiftUI

struct DayEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager

    let month: WorkMonth
    let isNew: Bool
    let onSave: (WorkDay) -> Void

    @State private var date: Date
    @State private var isWorked: Bool
    @State private var hoursText: String
    @State private var formAppeared = false

    init(month: WorkMonth, day: WorkDay, isNew: Bool, onSave: @escaping (WorkDay) -> Void) {
        self.month = month
        self.isNew = isNew
        self.onSave = onSave
        _date = State(initialValue: day.date)
        _isWorked = State(initialValue: day.isWorked)
        _hoursText = State(initialValue: Formatters.hours(day.hours))
        self.dayID = day.id
    }

    private let dayID: UUID

    private var canSave: Bool {
        !isWorked || parsedHours > 0
    }

    private var parsedHours: Double {
        Double(hoursText.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                VStack(spacing: 18) {
                    VStack(spacing: 18) {
                        DatePicker(
                            "Дата",
                            selection: $date.animation(.easeInOut(duration: 0.2)),
                            in: viewModel.dateRange(for: month),
                            displayedComponents: .date
                        )
                        .datePickerStyle(.compact)

                        Toggle("Работал", isOn: $isWorked.animation(.spring(response: 0.32, dampingFraction: 0.82)))
                            .tint(themeManager.palette.accent)

                        if isWorked {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Количество часов")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(themeManager.palette.secondaryText)

                                TextField("8 или 8.5", text: $hoursText)
                                    .keyboardType(.decimalPad)
                                    .textFieldStyle(.plain)
                                    .font(.title3.bold())
                                    .padding(16)
                                    .background(
                                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .fill(themeManager.palette.elevatedSurface)
                                    )
                                    .foregroundStyle(themeManager.palette.primaryText)
                            }
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }
                    }
                    .padding(20)
                    .themedCard()
                    .padding(.horizontal, 18)
                    .scaleEffect(formAppeared ? 1 : 0.96)
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
                        .disabled(!canSave)
                }
            }
            .onAppear {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                    formAppeared = true
                }
            }
        }
        .tint(themeManager.palette.accent)
    }

    private func save() {
        let day = WorkDay(
            id: dayID,
            date: date,
            isWorked: isWorked,
            hours: isWorked ? parsedHours : 0
        )
        onSave(day)
        dismiss()
    }
}
