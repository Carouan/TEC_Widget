package be.carouan.tecwidget

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

object ScheduleRepository {
    private const val DATA_URL = "https://carouan.github.io/TEC_Widget/data/schedules.json"
    private val dateKeyFormatter = DateTimeFormatter.ofPattern("yyyyMMdd")

    data class Result(
        val title: String,
        val route: String,
        val departures: List<String>,
        val status: String,
    )

    fun load(context: Context, now: LocalDateTime = LocalDateTime.now()): Result {
        val connection = (URL(DATA_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
            requestMethod = "GET"
            setRequestProperty("User-Agent", "TEC-Widget-Android/0.2")
            setRequestProperty("Accept", "application/json")
        }

        val json = connection.inputStream.bufferedReader().use { it.readText() }
        connection.disconnect()
        return parse(JSONObject(json), now, WidgetPreferences.load(context))
    }

    internal fun parse(
        root: JSONObject,
        now: LocalDateTime,
        settings: WidgetPreferences.Settings = WidgetPreferences.Settings(),
    ): Result {
        val intelligentAuto = settings.mode == "intelligent" && settings.period == "auto"
        val autoOutbound = now.hour < 12 || now.hour >= 20
        val profile = if (!intelligentAuto && settings.profileId != null) {
            settings.profileId
        } else {
            if (autoOutbound) "outbound" else "inbound"
        }
        val isOutbound = profile == "outbound"
        val fallbackTitle = if (isOutbound) "Maison → Travail" else "Travail → Maison"
        val title = "TEC · ${settings.favoriteName?.takeIf { settings.profileId == profile } ?: fallbackTitle}"
        val route = if (isOutbound) "9 → Jambes" else "9 → Flawinne"
        val startDate = resolveStartDate(now, settings, intelligentAuto)
        val profiles = root.getJSONObject("profiles")
        val services = root.getJSONObject("services")
        val exceptions = root.optJSONObject("exceptions") ?: JSONObject()
        val trips = profiles.getJSONArray(profile)
        val currentMinutes = now.hour * 60 + now.minute
        val (periodMin, periodMax) = periodBounds(settings)

        val collected = mutableListOf<Pair<LocalDate, Int>>()
        for (offset in 0..7) {
            val serviceDate = startDate.plusDays(offset.toLong())
            val threshold = if (serviceDate == now.toLocalDate()) {
                maxOf(periodMin, currentMinutes)
            } else {
                periodMin
            }

            for (index in 0 until trips.length()) {
                val item = trips.getJSONObject(index)
                val serviceId = item.getString("service_id")
                if (!serviceIsActive(serviceId, serviceDate, services, exceptions)) continue
                val minutes = parseGtfsMinutes(item.getString("time")) ?: continue
                if (minutes < threshold || minutes >= periodMax) continue
                collected += serviceDate to minutes
            }
            if (collected.size >= settings.departureCount) break
        }

        val next = collected
            .sortedWith(compareBy<Pair<LocalDate, Int>> { it.first }.thenBy { it.second })
            .take(settings.departureCount)
        val rendered = next.map { (date, minutes) -> formatDeparture(date, minutes, now) }
        val generated = root.optString("generated_at").take(10)
        val baseStatus = if (generated.isNotBlank()) "Horaires planifiés TEC · $generated" else "Horaires planifiés TEC"
        val status = if (settings.profileId != null) "$baseStatus · réglages synchronisés" else baseStatus

        return Result(title, route, rendered, status)
    }

    private fun resolveStartDate(
        now: LocalDateTime,
        settings: WidgetPreferences.Settings,
        intelligentAuto: Boolean,
    ): LocalDate {
        val currentMinutes = now.hour * 60 + now.minute
        return when (settings.period) {
            "morning" -> if (currentMinutes >= 12 * 60) now.toLocalDate().plusDays(1) else now.toLocalDate()
            "hour" -> if (currentMinutes > settings.referenceHour * 60) now.toLocalDate().plusDays(1) else now.toLocalDate()
            "auto" -> if (intelligentAuto && now.hour >= 20) now.toLocalDate().plusDays(1) else now.toLocalDate()
            else -> now.toLocalDate()
        }
    }

    private fun periodBounds(settings: WidgetPreferences.Settings): Pair<Int, Int> = when (settings.period) {
        "morning" -> 4 * 60 to 12 * 60
        "afternoon" -> 12 * 60 to 30 * 60
        "hour" -> settings.referenceHour * 60 to 30 * 60
        else -> 0 to 30 * 60
    }

    private fun serviceIsActive(serviceId: String, date: LocalDate, services: JSONObject, exceptions: JSONObject): Boolean {
        val key = date.format(dateKeyFormatter)
        val serviceExceptions = exceptions.optJSONObject(serviceId)
        when (serviceExceptions?.optInt(key, 0)) {
            1 -> return true
            2 -> return false
        }

        val service = services.optJSONObject(serviceId) ?: return false
        val start = service.optString("start_date")
        val end = service.optString("end_date")
        if (start.isNotBlank() && key < start) return false
        if (end.isNotBlank() && key > end) return false
        return service.optString(weekdayKey(date.dayOfWeek), "0") == "1"
    }

    private fun weekdayKey(day: DayOfWeek): String = when (day) {
        DayOfWeek.MONDAY -> "monday"
        DayOfWeek.TUESDAY -> "tuesday"
        DayOfWeek.WEDNESDAY -> "wednesday"
        DayOfWeek.THURSDAY -> "thursday"
        DayOfWeek.FRIDAY -> "friday"
        DayOfWeek.SATURDAY -> "saturday"
        DayOfWeek.SUNDAY -> "sunday"
    }

    private fun parseGtfsMinutes(value: String): Int? {
        val parts = value.split(':')
        if (parts.size < 2) return null
        val hours = parts[0].toIntOrNull() ?: return null
        val minutes = parts[1].toIntOrNull() ?: return null
        return hours * 60 + minutes
    }

    private fun formatDeparture(serviceDate: LocalDate, rawMinutes: Int, now: LocalDateTime): String {
        val daysOffset = rawMinutes / (24 * 60)
        val minutes = rawMinutes % (24 * 60)
        val actualDate = serviceDate.plusDays(daysOffset.toLong())
        val hour = minutes / 60
        val minute = minutes % 60
        val time = "%02d:%02d".format(hour, minute)

        if (actualDate == now.toLocalDate()) {
            val delta = (hour * 60 + minute) - (now.hour * 60 + now.minute)
            return if (delta >= 0) "$time   ·   dans $delta min" else time
        }
        if (actualDate == now.toLocalDate().plusDays(1)) return "$time   ·   demain"
        return "$time   ·   ${actualDate.dayOfMonth}/${actualDate.monthValue}"
    }
}
