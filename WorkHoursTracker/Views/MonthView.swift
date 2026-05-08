import SwiftUI

struct MonthView: View {
    @EnvironmentObject private var viewModel: WorkHoursViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var editingDay: WorkDay?
    @State private var isAddingDay = false
    @State private var addButtonPressed = false
    @State private var appeared = false

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
                        } footer: {
                            SignatureView()
                                .frame(maxWidth: .infinity)
                                .padding(.top, 12)
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
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    private var totalBar: some View {
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
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
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
