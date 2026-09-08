package be.carouan.tecwidget

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

class SyncPreferencesActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val imported = WidgetPreferences.importFromUri(this, intent?.data)
        if (imported) {
            TecWidgetProvider.enqueueRefresh(this)
            Toast.makeText(this, "Réglages appliqués au widget TEC", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Réglages TEC invalides", Toast.LENGTH_SHORT).show()
        }

        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
        )
        finish()
    }
}
