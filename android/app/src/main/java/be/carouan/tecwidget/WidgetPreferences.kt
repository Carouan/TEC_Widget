package be.carouan.tecwidget

import android.content.Context
import android.net.Uri

object WidgetPreferences {
    private const val PREFS_NAME = "tec-widget-preferences"
    private const val KEY_FAVORITE_ID = "favorite_id"
    private const val KEY_PROFILE_ID = "profile_id"
    private const val KEY_FAVORITE_NAME = "favorite_name"
    private const val KEY_MODE = "mode"
    private const val KEY_PERIOD = "period"
    private const val KEY_DEPARTURE_COUNT = "departure_count"
    private const val KEY_REFERENCE_HOUR = "reference_hour"

    private val validProfiles = setOf("outbound", "inbound")
    private val validModes = setOf("intelligent", "manual")
    private val validPeriods = setOf("auto", "now", "morning", "afternoon", "hour")

    data class Settings(
        val favoriteId: String? = null,
        val profileId: String? = null,
        val favoriteName: String? = null,
        val mode: String = "intelligent",
        val period: String = "auto",
        val departureCount: Int = 3,
        val referenceHour: Int = 7,
    )

    fun load(context: Context): Settings {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return Settings(
            favoriteId = prefs.getString(KEY_FAVORITE_ID, null),
            profileId = prefs.getString(KEY_PROFILE_ID, null)?.takeIf(validProfiles::contains),
            favoriteName = prefs.getString(KEY_FAVORITE_NAME, null),
            mode = prefs.getString(KEY_MODE, "intelligent")?.takeIf(validModes::contains) ?: "intelligent",
            period = prefs.getString(KEY_PERIOD, "auto")?.takeIf(validPeriods::contains) ?: "auto",
            departureCount = prefs.getInt(KEY_DEPARTURE_COUNT, 3).coerceIn(2, 5),
            referenceHour = prefs.getInt(KEY_REFERENCE_HOUR, 7).coerceIn(0, 23),
        )
    }

    fun importFromUri(context: Context, uri: Uri?): Boolean {
        if (uri?.scheme != "tecwidget" || uri.host != "sync") return false

        val profileId = uri.getQueryParameter("profileId")?.takeIf(validProfiles::contains) ?: return false
        val mode = uri.getQueryParameter("mode")?.takeIf(validModes::contains) ?: return false
        val period = uri.getQueryParameter("period")?.takeIf(validPeriods::contains) ?: return false
        val departureCount = uri.getQueryParameter("departureCount")?.toIntOrNull()?.takeIf { it in 2..5 } ?: return false
        val referenceHour = uri.getQueryParameter("referenceHour")?.toIntOrNull()?.takeIf { it in 0..23 } ?: return false
        val favoriteId = uri.getQueryParameter("favoriteId")?.take(120)
        val favoriteName = uri.getQueryParameter("favoriteName")?.take(120)

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_FAVORITE_ID, favoriteId)
            .putString(KEY_PROFILE_ID, profileId)
            .putString(KEY_FAVORITE_NAME, favoriteName)
            .putString(KEY_MODE, mode)
            .putString(KEY_PERIOD, period)
            .putInt(KEY_DEPARTURE_COUNT, departureCount)
            .putInt(KEY_REFERENCE_HOUR, referenceHour)
            .apply()
        return true
    }
}
