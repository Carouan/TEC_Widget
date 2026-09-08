package be.carouan.tecwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters

class TecWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { id ->
            appWidgetManager.updateAppWidget(id, baseViews(context, "Actualisation…"))
        }
        enqueueRefresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) enqueueRefresh(context)
    }

    companion object {
        const val ACTION_REFRESH = "be.carouan.tecwidget.REFRESH"
        private const val WORK_NAME = "tec-widget-refresh"

        fun enqueueRefresh(context: Context) {
            val request = OneTimeWorkRequestBuilder<TecWidgetWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        fun render(context: Context, result: ScheduleRepository.Result) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, TecWidgetProvider::class.java)
            val views = baseViews(context, result.status).apply {
                setTextViewText(R.id.widget_title, result.title)
                setTextViewText(R.id.widget_route, result.route)
                val ids = listOf(R.id.widget_departure_1, R.id.widget_departure_2, R.id.widget_departure_3)
                ids.forEachIndexed { index, id ->
                    setTextViewText(id, result.departures.getOrNull(index) ?: "—")
                }
            }
            manager.updateAppWidget(component, views)
        }

        fun renderError(context: Context, message: String) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, TecWidgetProvider::class.java)
            val views = baseViews(context, "Actualisation impossible · toucher ↻").apply {
                setTextViewText(R.id.widget_departure_1, message)
                setTextViewText(R.id.widget_departure_2, "")
                setTextViewText(R.id.widget_departure_3, "")
            }
            manager.updateAppWidget(component, views)
        }

        private fun baseViews(context: Context, status: String): RemoteViews {
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
            }
        }
    }
}

class TecWidgetWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        return try {
            TecWidgetProvider.render(applicationContext, ScheduleRepository.load())
            Result.success()
        } catch (error: Exception) {
            TecWidgetProvider.renderError(applicationContext, "Données indisponibles")
            Result.retry()
        }
    }
}
