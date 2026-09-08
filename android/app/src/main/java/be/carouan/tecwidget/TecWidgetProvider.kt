package be.carouan.tecwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters

class TecWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { id ->
            appWidgetManager.updateAppWidget(id, baseViews(context, "Actualisation…", appWidgetManager.getAppWidgetOptions(id)))
        }
        enqueueRefresh(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        appWidgetManager.updateAppWidget(appWidgetId, baseViews(context, "Actualisation…", newOptions))
        enqueueRefresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH -> enqueueRefresh(context)
            ACTION_CYCLE_PROFILE -> {
                WidgetPreferences.cycleProfile(context)
                enqueueRefresh(context)
            }
            ACTION_TOGGLE_MODE -> {
                WidgetPreferences.toggleMode(context)
                enqueueRefresh(context)
            }
            ACTION_CYCLE_PERIOD -> {
                WidgetPreferences.cyclePeriod(context)
                enqueueRefresh(context)
            }
            ACTION_CYCLE_COUNT -> {
                WidgetPreferences.cycleDepartureCount(context)
                enqueueRefresh(context)
            }
            ACTION_CYCLE_HOUR -> {
                WidgetPreferences.cycleReferenceHour(context)
                enqueueRefresh(context)
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "be.carouan.tecwidget.REFRESH"
        const val ACTION_CYCLE_PROFILE = "be.carouan.tecwidget.CYCLE_PROFILE"
        const val ACTION_TOGGLE_MODE = "be.carouan.tecwidget.TOGGLE_MODE"
        const val ACTION_CYCLE_PERIOD = "be.carouan.tecwidget.CYCLE_PERIOD"
        const val ACTION_CYCLE_COUNT = "be.carouan.tecwidget.CYCLE_COUNT"
        const val ACTION_CYCLE_HOUR = "be.carouan.tecwidget.CYCLE_HOUR"

        private const val WORK_NAME = "tec-widget-refresh"
        private const val CONTROLS_MIN_HEIGHT_DP = 180
        private const val FOUR_ROWS_MIN_HEIGHT_DP = 235
        private const val FIVE_ROWS_MIN_HEIGHT_DP = 270
        private const val VERY_COMPACT_HEIGHT_DP = 118

        fun enqueueRefresh(context: Context) {
            val request = OneTimeWorkRequestBuilder<TecWidgetWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        fun render(context: Context, result: ScheduleRepository.Result) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, TecWidgetProvider::class.java)
            val widgetIds = manager.getAppWidgetIds(component)
            val settings = WidgetPreferences.load(context)

            widgetIds.forEach { widgetId ->
                val options = manager.getAppWidgetOptions(widgetId)
                val views = baseViews(context, result.status, options, settings).apply {
                    setTextViewText(R.id.widget_title, result.title)
                    setTextViewText(R.id.widget_route, result.route)
                    val ids = listOf(
                        R.id.widget_departure_1,
                        R.id.widget_departure_2,
                        R.id.widget_departure_3,
                        R.id.widget_departure_4,
                        R.id.widget_departure_5,
                    )
                    ids.forEachIndexed { index, id ->
                        setTextViewText(id, result.departures.getOrNull(index) ?: "—")
                    }
                    applySizing(options, settings)
                }
                manager.updateAppWidget(widgetId, views)
            }
        }

        fun renderError(context: Context, message: String) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, TecWidgetProvider::class.java)
            val widgetIds = manager.getAppWidgetIds(component)
            val settings = WidgetPreferences.load(context)

            widgetIds.forEach { widgetId ->
                val options = manager.getAppWidgetOptions(widgetId)
                val views = baseViews(context, "Actualisation impossible · toucher ↻", options, settings).apply {
                    setTextViewText(R.id.widget_departure_1, message)
                    listOf(
                        R.id.widget_departure_2,
                        R.id.widget_departure_3,
                        R.id.widget_departure_4,
                        R.id.widget_departure_5,
                    ).forEach { setTextViewText(it, "") }
                    applySizing(options, settings)
                }
                manager.updateAppWidget(widgetId, views)
            }
        }

        private fun baseViews(
            context: Context,
            status: String,
            options: Bundle,
            settings: WidgetPreferences.Settings = WidgetPreferences.load(context),
        ): RemoteViews {
            val openPendingIntent = PendingIntent.getActivity(
                context,
                1,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            return RemoteViews(context.packageName, R.layout.tec_widget).apply {
                setOnClickPendingIntent(R.id.widget_root, openPendingIntent)
                bindAction(context, R.id.widget_refresh, ACTION_REFRESH, 2)
                bindAction(context, R.id.widget_control_profile, ACTION_CYCLE_PROFILE, 3)
                bindAction(context, R.id.widget_control_mode, ACTION_TOGGLE_MODE, 4)
                bindAction(context, R.id.widget_control_period, ACTION_CYCLE_PERIOD, 5)
                bindAction(context, R.id.widget_control_hour, ACTION_CYCLE_HOUR, 6)
                bindAction(context, R.id.widget_control_count, ACTION_CYCLE_COUNT, 7)
                setTextViewText(R.id.widget_status, status)
                bindControlLabels(settings)
                applySizing(options, settings)
            }
        }

        private fun RemoteViews.bindAction(context: Context, viewId: Int, action: String, requestCode: Int) {
            val intent = Intent(context, TecWidgetProvider::class.java).apply { this.action = action }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            setOnClickPendingIntent(viewId, pendingIntent)
        }

        private fun RemoteViews.bindControlLabels(settings: WidgetPreferences.Settings) {
            setTextViewText(R.id.widget_control_profile, if (settings.profileId == "inbound") "⇄ Retour" else "⇄ Aller")
            setTextViewText(R.id.widget_control_mode, if (settings.mode == "intelligent") "Auto" else "Manuel")
            setTextViewText(R.id.widget_control_period, periodLabel(settings.period))
            setTextViewText(R.id.widget_control_hour, "%02dh".format(settings.referenceHour))
            setTextViewText(R.id.widget_control_count, "${settings.departureCount}×")
        }

        private fun periodLabel(period: String): String = when (period) {
            "now" -> "Maint."
            "morning" -> "Matin"
            "afternoon" -> "Après-m."
            "hour" -> "Heure"
            else -> "Auto"
        }

        private fun RemoteViews.applySizing(options: Bundle, settings: WidgetPreferences.Settings) {
            val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 170)
            val veryCompact = height < VERY_COMPACT_HEIGHT_DP
            val controlsVisible = height >= CONTROLS_MIN_HEIGHT_DP
            val maxRows = when {
                veryCompact -> 2
                height >= FIVE_ROWS_MIN_HEIGHT_DP -> 5
                height >= FOUR_ROWS_MIN_HEIGHT_DP -> 4
                else -> 3
            }
            val visibleRows = minOf(settings.departureCount, maxRows)

            setViewVisibility(R.id.widget_controls, if (controlsVisible) View.VISIBLE else View.GONE)
            setViewVisibility(
                R.id.widget_control_hour,
                if (controlsVisible && settings.period == "hour") View.VISIBLE else View.GONE,
            )
            setViewVisibility(R.id.widget_route, if (veryCompact) View.GONE else View.VISIBLE)
            setViewVisibility(R.id.widget_status, if (veryCompact) View.GONE else View.VISIBLE)

            val departureIds = listOf(
                R.id.widget_departure_1,
                R.id.widget_departure_2,
                R.id.widget_departure_3,
                R.id.widget_departure_4,
                R.id.widget_departure_5,
            )
            departureIds.forEachIndexed { index, id ->
                setViewVisibility(id, if (index < visibleRows) View.VISIBLE else View.GONE)
            }

            val compact = height < CONTROLS_MIN_HEIGHT_DP
            val departureSize = if (compact) 17f else 18f
            val titleSize = if (compact) 14f else 15f
            setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, titleSize)
            departureIds.forEach { setTextViewTextSize(it, TypedValue.COMPLEX_UNIT_SP, departureSize) }
        }
    }
}

class TecWidgetWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        return try {
            TecWidgetProvider.render(applicationContext, ScheduleRepository.load(applicationContext))
            Result.success()
        } catch (error: Exception) {
            TecWidgetProvider.renderError(applicationContext, "Données indisponibles")
            Result.retry()
        }
    }
}
