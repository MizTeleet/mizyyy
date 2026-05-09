package com.renatdeveloper.workhourstracker

import android.app.Application
import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import java.util.UUID
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WorkHoursAndroidApp()
        }
    }
}

data class WorkMonth(
    val id: String = UUID.randomUUID().toString(),
    val year: Int,
    val month: Int,
    val hourlyRate: Double,
    val days: List<WorkDay> = emptyList()
) {
    val totalHours: Double get() = days.sumOf { if (it.isWorked) it.hours else 0.0 }
    val totalEarned: Double get() = totalHours * hourlyRate
}

data class WorkDay(
    val id: String = UUID.randomUUID().toString(),
    val dayOfMonth: Int,
    val isWorked: Boolean = true,
    val workName: String = "",
    val startMinute: Int = 0,
    val endMinute: Int = 7 * 60
) {
    val hours: Double
        get() {
            if (!isWorked) return 0.0
            val diff = if (endMinute >= startMinute) endMinute - startMinute else (24 * 60 - startMinute) + endMinute
            return diff / 60.0
        }
}

class WorkRepository(context: Context) {
    private val prefs = context.getSharedPreferences("work_hours_android", Context.MODE_PRIVATE)
    private val key = "months_json"

    fun load(): List<WorkMonth> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) add(array.getJSONObject(i).toMonth())
            }.sortedWith(compareBy<WorkMonth> { it.year }.thenBy { it.month })
        }.getOrElse { emptyList() }
    }

    fun save(months: List<WorkMonth>) {
        val array = JSONArray()
        months.sortedWith(compareBy<WorkMonth> { it.year }.thenBy { it.month }).forEach { array.put(it.toJson()) }
        prefs.edit().putString(key, array.toString()).apply()
    }
}

private fun WorkMonth.toJson() = JSONObject().apply {
    put("id", id)
    put("year", year)
    put("month", month)
    put("hourlyRate", hourlyRate)
    put("days", JSONArray().also { dayArray -> days.forEach { dayArray.put(it.toJson()) } })
}

private fun WorkDay.toJson() = JSONObject().apply {
    put("id", id)
    put("dayOfMonth", dayOfMonth)
    put("isWorked", isWorked)
    put("workName", workName)
    put("startMinute", startMinute)
    put("endMinute", endMinute)
}

private fun JSONObject.toMonth(): WorkMonth {
    val daysArray = optJSONArray("days") ?: JSONArray()
    val parsedDays = buildList {
        for (i in 0 until daysArray.length()) add(daysArray.getJSONObject(i).toDay())
    }.sortedBy { it.dayOfMonth }
    return WorkMonth(
        id = optString("id", UUID.randomUUID().toString()),
        year = optInt("year"),
        month = optInt("month"),
        hourlyRate = optDouble("hourlyRate", 0.0),
        days = parsedDays
    )
}

private fun JSONObject.toDay(): WorkDay = WorkDay(
    id = optString("id", UUID.randomUUID().toString()),
    dayOfMonth = optInt("dayOfMonth", optInt("day", 1)).coerceIn(1, 31),
    isWorked = optBoolean("isWorked", true),
    workName = optString("workName", ""),
    startMinute = optInt("startMinute", 0).coerceIn(0, 1439),
    endMinute = optInt("endMinute", 7 * 60).coerceIn(0, 1439)
)

class WorkHoursAndroidViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = WorkRepository(application.applicationContext)
    private val _months = MutableStateFlow(repository.load())
    val months: StateFlow<List<WorkMonth>> = _months

    fun canCreateMonth(year: Int, month: Int): Boolean = _months.value.none { it.year == year && it.month == month }

    fun createMonth(year: Int, month: Int, hourlyRate: Double) {
        if (!canCreateMonth(year, month) || hourlyRate <= 0) return
        update(_months.value + WorkMonth(year = year, month = month, hourlyRate = hourlyRate))
    }

    fun deleteMonth(monthId: String) = update(_months.value.filterNot { it.id == monthId })

    fun updateRate(monthId: String, rate: Double) {
        if (rate <= 0) return
        update(_months.value.map { if (it.id == monthId) it.copy(hourlyRate = rate) else it })
    }

    fun saveDay(monthId: String, day: WorkDay) {
        update(_months.value.map { month ->
            if (month.id != monthId) month else {
                val days = month.days.filterNot { it.id == day.id } + day
                month.copy(days = days.sortedBy { it.dayOfMonth })
            }
        })
    }

    fun deleteDay(monthId: String, dayId: String) {
        update(_months.value.map { month ->
            if (month.id == monthId) month.copy(days = month.days.filterNot { it.id == dayId }) else month
        })
    }

    private fun update(months: List<WorkMonth>) {
        val sorted = months.sortedWith(compareBy<WorkMonth> { it.year }.thenBy { it.month })
        _months.value = sorted
        repository.save(sorted)
    }
}

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun WorkHoursAndroidApp() {
    val app = LocalContext.current.applicationContext as Application
    val vm: WorkHoursAndroidViewModel = viewModel(factory = remember(app) {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return WorkHoursAndroidViewModel(app) as T
            }
        }
    })
    val months by vm.months.collectAsState()
    var selectedMonthId by remember { mutableStateOf<String?>(null) }
    val selectedMonth = months.firstOrNull { it.id == selectedMonthId }

    MaterialTheme(colorScheme = darkColorScheme(background = NeonBlack, surface = GlassSurface, primary = CyanGlow)) {
        Surface(color = Color.Transparent) {
            AnimatedContent(targetState = selectedMonth, label = "root") { month ->
                if (month == null) {
                    HomeScreen(months = months, vm = vm, onOpenMonth = { selectedMonthId = it.id })
                } else {
                    BackHandler { selectedMonthId = null }
                    MonthScreen(month = month, vm = vm, onBack = { selectedMonthId = null })
                }
            }
        }
    }
}

@Composable
private fun PremiumBackground(animated: Boolean = true, content: @Composable BoxScope.() -> Unit) {
    val transition = rememberInfiniteTransition(label = "neon-bg")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(18000), RepeatMode.Restart),
        label = "phase"
    )
    val p = if (animated) phase else 0f

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(NeonBlack, Color(0xFF12062A), Color(0xFF001B22), NeonBlack),
                    start = Offset(600f + 420f * cos(p), 120f + 260f * sin(p)),
                    end = Offset(120f + 420f * cos(p + PI.toFloat()), 1200f + 260f * sin(p + PI.toFloat()))
                )
            )
    ) {
        GlowBlob(CyanGlow.copy(alpha = 0.23f), 320, (-130 + 58 * cos(p / 2f)).dp, (-180 + 44 * sin(p / 2.4f)).dp)
        GlowBlob(PurpleGlow.copy(alpha = 0.18f), 300, (170 + 48 * sin(p / 2.7f)).dp, (520 + 36 * cos(p / 2.2f)).dp)
        content()
    }
}

@Composable
private fun GlowBlob(color: Color, size: Int, x: androidx.compose.ui.unit.Dp, y: androidx.compose.ui.unit.Dp) {
    Box(
        Modifier
            .offset { IntOffset(x.roundToPx(), y.roundToPx()) }
            .size(size.dp)
            .blur(56.dp)
            .background(Brush.radialGradient(listOf(color, Color.Transparent)), CircleShape)
    )
}

@Composable
private fun HomeScreen(months: List<WorkMonth>, vm: WorkHoursAndroidViewModel, onOpenMonth: (WorkMonth) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }
    var menuMonth by remember { mutableStateOf<WorkMonth?>(null) }
    var rateMonth by remember { mutableStateOf<WorkMonth?>(null) }

    PremiumBackground {
        Box(Modifier.fillMaxSize()) {
            LazyColumn(
                contentPadding = PaddingValues(
                    start = 18.dp,
                    end = 18.dp,
                    top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 18.dp,
                    bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 104.dp
                ),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text("Рабочие часы", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
                    Text("Месяцы, ставки, смены и заработок.", color = SoftText, fontSize = 15.sp, modifier = Modifier.padding(top = 6.dp))
                }
                if (months.isEmpty()) {
                    item { EmptyState(onAdd = { showAdd = true }) }
                } else {
                    items(months, key = { it.id }) { month ->
                        MonthCard(
                            month = month,
                            onClick = { onOpenMonth(month) },
                            onLongPress = { menuMonth = month }
                        )
                    }
                }
                item { Signature() }
            }

            FloatingPlus(Modifier.align(Alignment.BottomEnd).padding(24.dp)) { showAdd = true }
        }
    }

    menuMonth?.let { month ->
        MonthActionDialog(
            month = month,
            onDismiss = { menuMonth = null },
            onDelete = { vm.deleteMonth(month.id); menuMonth = null },
            onChangeRate = { rateMonth = month; menuMonth = null }
        )
    }
    if (showAdd) AddMonthDialog(vm = vm, onDismiss = { showAdd = false })
    rateMonth?.let { month -> RateDialog(month = month, onDismiss = { rateMonth = null }, onSave = { vm.updateRate(month.id, it); rateMonth = null }) }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MonthCard(month: WorkMonth, onClick: () -> Unit, onLongPress: () -> Unit) {
    GlassCard(
        Modifier
            .fillMaxWidth()
            .height(190.dp)
            .combinedClickable(onClick = onClick, onLongClick = onLongPress)
            .animateContentSize(spring())
    ) {
        Box(Modifier.fillMaxSize().background(CardGradient()))
        Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(monthTitle(month.month, month.year), color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black)
                    Text("${month.days.size} записей", color = SoftText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
                Text("›", color = Color.White.copy(alpha = 0.75f), fontSize = 34.sp, fontWeight = FontWeight.Light)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Metric("Часы", "${fmt(month.totalHours)} ч", Modifier.weight(1f))
                Metric("Ставка", fmt(month.hourlyRate), Modifier.weight(1f))
                Metric("Заработал", "${fmt(month.totalEarned)} zł", Modifier.weight(1f), PositiveGreen)
            }
        }
    }
}

@Composable
private fun MonthScreen(month: WorkMonth, vm: WorkHoursAndroidViewModel, onBack: () -> Unit) {
    var showDayEditor by remember { mutableStateOf<WorkDay?>(null) }
    var editRate by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val collapse by remember { derivedStateOf { (listState.firstVisibleItemScrollOffset / 130f).coerceIn(0f, 1f) } }

    PremiumBackground {
        Column(Modifier.fillMaxSize()) {
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 8.dp,
                    bottom = 18.dp
                ),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.weight(1f)
            ) {
                item {
                    CollapsingMonthHeader(month = month, collapse = collapse, onBack = onBack, onRate = { editRate = true })
                }
                items(month.days, key = { it.id }) { day ->
                    SwipeDayRow(day = day, hourlyRate = month.hourlyRate, onClick = { showDayEditor = day }, onDelete = { vm.deleteDay(month.id, day.id) })
                }
            }
            BottomStatsBar(month = month, onAdd = { showDayEditor = WorkDay(dayOfMonth = 1.coerceAtMost(daysInMonth(month.month, month.year))) })
        }
    }

    showDayEditor?.let { day ->
        DayEditorDialog(month = month, initial = day, onDismiss = { showDayEditor = null }, onSave = { vm.saveDay(month.id, it); showDayEditor = null })
    }
    if (editRate) RateDialog(month = month, onDismiss = { editRate = false }, onSave = { vm.updateRate(month.id, it); editRate = false })
}

@Composable
private fun CollapsingMonthHeader(month: WorkMonth, collapse: Float, onBack: () -> Unit, onRate: () -> Unit) {
    Column(
        Modifier
            .graphicsLayer {
                alpha = 1f - collapse
                translationY = -60f * collapse
                scaleX = 1f - 0.025f * collapse
                scaleY = 1f - 0.025f * collapse
            }
            .padding(vertical = 8.dp)
    ) {
        TextButton(onClick = onBack) { Text("‹ Назад", color = CyanGlow) }
        Text(monthTitle(month.month, month.year), color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Ставка: ${fmt(month.hourlyRate)}", color = CyanGlow, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(10.dp))
            TextButton(onClick = onRate) { Text("Изменить ставку", color = CyanGlow) }
        }
        Text("Заголовок мягко скрывается при прокрутке. Tap — редактировать, swipe — удалить.", color = SoftText, fontSize = 14.sp)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeDayRow(day: WorkDay, hourlyRate: Double, onClick: () -> Unit, onDelete: () -> Unit) {
    val state = rememberSwipeToDismissBoxState(confirmValueChange = {
        if (it != SwipeToDismissBoxValue.Settled) {
            onDelete(); true
        } else false
    })
    SwipeToDismissBox(state = state, backgroundContent = { Box(Modifier.fillMaxSize().clip(RoundedCornerShape(24.dp)).background(Color(0xFF3A0712))) }, content = {
        DayCard(day = day, hourlyRate = hourlyRate, onClick = onClick)
    })
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun DayCard(day: WorkDay, hourlyRate: Double, onClick: () -> Unit) {
    val earned = day.hours * hourlyRate
    GlassCard(Modifier.fillMaxWidth().combinedClickable(onClick = onClick, onLongClick = {})) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("${day.dayOfMonth} ${monthNameShort(LocalMonth.currentMonth)}", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(if (day.isWorked) "Работал" else "Не работал", color = if (day.isWorked) PositiveGreen else SoftText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                if (day.isWorked) {
                    Text(day.workName.ifBlank { "Без названия" }, color = Color.White.copy(alpha = 0.88f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    CapsuleText("${minuteText(day.startMinute)} - ${minuteText(day.endMinute)}")
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${fmt(day.hours)} ч", color = CyanGlow, fontSize = 17.sp, fontWeight = FontWeight.Black)
                if (day.isWorked) Text("${fmt(earned)} zł", color = PositiveGreen, fontSize = 15.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

private object LocalMonth { var currentMonth: Int = 1 }

@Composable
private fun BottomStatsBar(month: WorkMonth, onAdd: () -> Unit) {
    LocalMonth.currentMonth = month.month
    Box(Modifier.padding(horizontal = 16.dp, vertical = 10.dp).padding(bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding())) {
        GlassCard(Modifier.fillMaxWidth()) {
            Row(Modifier.padding(horizontal = 18.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row { Text("Всего часов", color = SoftText, fontSize = 12.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.width(8.dp)); Text(fmt(month.totalHours), color = Color.White, fontWeight = FontWeight.Black) }
                    Row { Text("Заработал", color = SoftText, fontSize = 12.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.width(8.dp)); Text("${fmt(month.totalEarned)} zł", color = PositiveGreen, fontWeight = FontWeight.Black) }
                }
                FloatingPlus(size = 50, onClick = onAdd)
            }
        }
    }
}

@Composable
private fun EmptyState(onAdd: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 120.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(112.dp).blur(10.dp).background(CyanGlow.copy(alpha = 0.16f), CircleShape))
        Text("Добавьте первый месяц", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        Text("Нажмите +, выберите месяц, год и ставку.", color = SoftText, textAlign = TextAlign.Center, modifier = Modifier.padding(12.dp))
        TextButton(onClick = onAdd) { Text("Создать месяц", color = CyanGlow, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun AddMonthDialog(vm: WorkHoursAndroidViewModel, onDismiss: () -> Unit) {
    val nowYear = 2026
    var month by remember { mutableStateOf(5) }
    var year by remember { mutableStateOf(nowYear) }
    var rate by remember { mutableStateOf("") }
    val parsed = rate.replace(',', '.').toDoubleOrNull() ?: 0.0
    val canCreate = parsed > 0 && vm.canCreateMonth(year, month)
    NeonDialog(onDismiss = onDismiss, title = "Новый месяц") {
        WheelRow("Месяц", (1..12).map { it to monthName(it) }, month) { month = it }
        WheelRow("Год", ((nowYear - 5)..(nowYear + 5)).map { it to it.toString() }, year) { year = it }
        OutlinedTextField(value = rate, onValueChange = { rate = it }, label = { Text("Ставка за час") }, placeholder = { Text("31.4") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.fillMaxWidth())
        if (!vm.canCreateMonth(year, month)) Text("Этот месяц уже создан", color = Color(0xFFFF5C8A))
        DialogButtons(onDismiss, enabled = canCreate) { vm.createMonth(year, month, parsed); onDismiss() }
    }
}

@Composable
private fun DayEditorDialog(month: WorkMonth, initial: WorkDay, onDismiss: () -> Unit, onSave: (WorkDay) -> Unit) {
    var day by remember { mutableStateOf(initial.dayOfMonth.coerceIn(1, daysInMonth(month.month, month.year))) }
    var isWorked by remember { mutableStateOf(initial.isWorked) }
    var workName by remember { mutableStateOf(initial.workName) }
    var start by remember { mutableStateOf(initial.startMinute) }
    var end by remember { mutableStateOf(initial.endMinute) }
    val preview = WorkDay(id = initial.id, dayOfMonth = day, isWorked = isWorked, workName = workName, startMinute = start, endMinute = end)
    NeonDialog(onDismiss = onDismiss, title = "Смена") {
        WheelRow("День", (1..daysInMonth(month.month, month.year)).map { it to it.toString() }, day) { day = it }
        Row(verticalAlignment = Alignment.CenterVertically) { Text("Работал", color = Color.White, modifier = Modifier.weight(1f)); Switch(isWorked, { isWorked = it }) }
        AnimatedVisibility(isWorked, enter = fadeIn() + scaleIn(), exit = fadeOut() + scaleOut()) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(value = workName, onValueChange = { workName = it }, label = { Text("Название смены") }, placeholder = { Text("Amazon Night Shift") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                TimeEditor("Начал", start) { start = it }
                TimeEditor("Закончил", end) { end = it }
                Text("Количество часов: ${fmt(preview.hours)} ч", color = CyanGlow, fontWeight = FontWeight.Black)
                Text("Заработок: ${fmt(preview.hours * month.hourlyRate)} zł", color = PositiveGreen, fontWeight = FontWeight.Black)
            }
        }
        DialogButtons(onDismiss, enabled = !isWorked || preview.hours > 0) { onSave(preview) }
    }
}

@Composable
private fun RateDialog(month: WorkMonth, onDismiss: () -> Unit, onSave: (Double) -> Unit) {
    var rate by remember { mutableStateOf(fmt(month.hourlyRate)) }
    val parsed = rate.replace(',', '.').toDoubleOrNull() ?: 0.0
    NeonDialog(onDismiss = onDismiss, title = "Изменить ставку") {
        OutlinedTextField(value = rate, onValueChange = { rate = it }, label = { Text("Ставка за час") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.fillMaxWidth())
        DialogButtons(onDismiss, enabled = parsed > 0) { onSave(parsed) }
    }
}

@Composable
private fun MonthActionDialog(month: WorkMonth, onDismiss: () -> Unit, onDelete: () -> Unit, onChangeRate: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xEE090915),
        title = { Text(monthTitle(month.month, month.year), color = Color.White) },
        text = {
            Column {
                TextButton(onClick = onChangeRate) { Text("Изменить ставку", color = CyanGlow) }
                TextButton(onClick = onDelete) { Text("Удалить месяц", color = Color(0xFFFF5C8A)) }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Готово", color = CyanGlow) } }
    )
}

@Composable
private fun NeonDialog(onDismiss: () -> Unit, title: String, content: @Composable Column.() -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xEE090915),
        title = { Text(title, color = Color.White, fontWeight = FontWeight.Black) },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp), content = content) },
        confirmButton = {},
        dismissButton = {}
    )
}

@Composable
private fun DialogButtons(onDismiss: () -> Unit, enabled: Boolean, onSave: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        TextButton(onClick = onDismiss) { Text("Отмена", color = SoftText) }
        TextButton(onClick = onSave, enabled = enabled) { Text("Сохранить", color = if (enabled) CyanGlow else SoftText) }
    }
}

@Composable
private fun TimeEditor(title: String, minutes: Int, onChange: (Int) -> Unit) {
    val hour = minutes / 60
    val minute = minutes % 60
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, color = SoftText, modifier = Modifier.width(72.dp))
        WheelRow("ч", (0..23).map { it to it.toString().padStart(2, '0') }, hour, Modifier.weight(1f)) { onChange(it * 60 + minute) }
        WheelRow("м", listOf(0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55).map { it to it.toString().padStart(2, '0') }, minute - minute % 5, Modifier.weight(1f)) { onChange(hour * 60 + it) }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun <T> WheelRow(label: String, values: List<Pair<T, String>>, selected: T, modifier: Modifier = Modifier, onSelect: (T) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        GlassCard(Modifier.fillMaxWidth().combinedClickable(onClick = { expanded = true }, onLongClick = { expanded = true })) {
            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = SoftText, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text(values.firstOrNull { it.first == selected }?.second ?: "—", color = Color.White, fontWeight = FontWeight.Black)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.height(260.dp).background(Color(0xEE090915))) {
            values.forEach { (value, text) -> DropdownMenuItem(text = { Text(text, color = Color.White) }, onClick = { onSelect(value); expanded = false }) }
        }
    }
}

@Composable
private fun GlassCard(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Card(
        modifier = modifier.shadow(16.dp, RoundedCornerShape(28.dp), ambientColor = CyanGlow.copy(alpha = 0.20f), spotColor = CyanGlow.copy(alpha = 0.20f)),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = GlassSurface.copy(alpha = 0.58f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, CyanGlow.copy(alpha = 0.24f))
    ) { Box(Modifier.fillMaxWidth(), content = content) }
}

@Composable
private fun FloatingPlus(modifier: Modifier = Modifier, size: Int = 62, onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        colors = ButtonDefaults.textButtonColors(containerColor = CyanGlow),
        shape = CircleShape,
        modifier = modifier.size(size.dp).shadow(18.dp, CircleShape, ambientColor = CyanGlow.copy(alpha = 0.38f), spotColor = CyanGlow.copy(alpha = 0.38f)),
        contentPadding = PaddingValues(0.dp)
    ) { Text("+", color = Color.Black, fontSize = 30.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun Metric(title: String, value: String, modifier: Modifier = Modifier, color: Color = Color.White) {
    Column(modifier) {
        Text(title, color = SoftText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(value, color = color, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun CapsuleText(value: String) {
    Text(
        value,
        color = CyanGlow,
        fontSize = 12.sp,
        fontWeight = FontWeight.Black,
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(CyanGlow.copy(alpha = 0.13f)).padding(horizontal = 10.dp, vertical = 5.dp)
    )
}

@Composable
private fun Signature() {
    Text("Renat developer", color = SoftText.copy(alpha = 0.45f), fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), textAlign = TextAlign.Center)
}

private fun CardGradient() = Brush.linearGradient(listOf(Color(0xFF101022), Color(0xFF071923), CyanGlow.copy(alpha = 0.28f)))
private fun fmt(value: Double): String = DecimalFormat("0.##", DecimalFormatSymbols(Locale.US)).format(value)
private fun monthTitle(month: Int, year: Int) = "${monthName(month)} $year"
private fun monthName(month: Int) = listOf("Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь")[month.coerceIn(1, 12) - 1]
private fun monthNameShort(month: Int) = listOf("янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек")[month.coerceIn(1, 12) - 1]
private fun daysInMonth(month: Int, year: Int): Int = when (month) { 4, 6, 9, 11 -> 30; 2 -> if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) 29 else 28; else -> 31 }
private fun minuteText(minutes: Int) = "${(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}"

private val NeonBlack = Color(0xFF02000F)
private val GlassSurface = Color(0xFF141426)
private val CyanGlow = Color(0xFF00EFFF)
private val PurpleGlow = Color(0xFF8B5CFF)
private val SoftText = Color.White.copy(alpha = 0.68f)
private val PositiveGreen = Color(0xFF65F08B)
