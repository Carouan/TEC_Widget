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
        if (intent.action == ACTION_REFRESH) enqueueRefresh(context)
    }

    companion object {
        const val ACTION_REFRESH = "be.carouan.tecwidget.REFRESH"
        private const val WORK_NAME = "tec-widget-refresh"
        private const val COMPACT_HEIGHT_DP = 145
        private const val VERY_COMPACT_HEIGHT_DP = 118

        fun enqueueRefresh(context: Context) {
            val request = OneTimeWorkRequestBuilder<TecWidgetWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        fun render(context: Context, result: ScheduleRepository.Result) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, TecWidgetProvider::class.java)
            val widgetIds = manager.getAppWidgetIds(component)

            widgetIds.forEach { widgetId ->
                val options = manager.getAppWidgetOptions(widgetId)
                val views = baseViews(context, result.status, options).apply {
                    setTextViewText(R.id.widget_title, result.title)
                    setTextViewText(R.id.widget_route, result.route)
                    val ids = listOf(R.id.widget_departure_1, R.id.widget_departure_2, R.id.widget_departure_3)
                    ids.forEachIndexed { index, id ->
                        setTextViewText(id, result.departures.getOrNull(index) ?: "—")
                    }
                    applySizing(options)
                }
                manager.updateAppWidget(widgetId, views)
            }
        }

        fun renderError(context: Context, message: String) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, TecWidgetProvider::class.java)
            val widgetIds = manager.getAppWidgetIds(component)

            widgetIds.forEach { widgetId ->
                val options = manager.getAppWidgetOptions(widgetId)
                val views = baseViews(context, "Actualisation impossible · toucher ↻", options).apply {
                    setTextViewText(R.id.widget_departure_1, message)
                    setTextViewText(R.id.widget_departure_2, "")
                    setTextViewText(R.id.widget_departure_3, "")
                    applySizing(options)
                }
                manager.updateAppWidget(widgetId, views)
            }
        }

        private fun baseViews(context: Context, status: String, options: Bundle): RemoteViews {
            val openIntent = Intent(context, MainActivity::class.java)
            val openPendingIntent = PendingIntent.getActivity(
                context,
                1,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val refreshIntent = Intent(context, TecWidgetProvider::class.java).apply { action = ACTION_REFRESH }
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context,
                2,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            return RemoteViews(context.packageName, R.layout.tec_widget).apply {
                setOnClickPendingIntent(R.id.widget_root, openPendingIntent)
                setOnClickPendingIntent(R.id.widget_refresh, refreshPendingIntent)
                setTextViewText(R.id.widget_status, status)
                applySizing(options)
            }
        }

        private fun RemoteViews.applySizing(options: Bundle) {
            val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 170)
            val compact = height < COMPACT_HEIGHT_DP
            val veryCompact = height < VERY_COMPACT_HEIGHT_DP

            setViewVisibility(R.id.widget_departure_3, if (compact) View.GONE else View.VISIBLE)
            setViewVisibility(R.id.widget_status, if (veryCompact) View.GONE else View.VISIBLE)
            setViewVisibility(R.id.widget_route, if (veryCompact) View.GONE else View.VISIBLE)

            val departureSize = if (compact) 17f else 19f
            val titleSize = if (compact) 14f else 15f
            setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, titleSize)
            setTextViewTextSize(R.id.widget_departure_1, TypedValue.COMPLEX_UNIT_SP, departureSize)
            setTextViewTextSize(R.id.widget_departure_2, TypedValue.COMPLEX_UNIT_SP, departureSize)
            setTextViewTextSize(R.id.widget_departure_3, TypedValue.COMPLEX_UNIT_SP, departureSize)
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
