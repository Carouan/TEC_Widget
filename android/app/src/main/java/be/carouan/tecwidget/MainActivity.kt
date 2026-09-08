package be.carouan.tecwidget

import android.net.Uri
import com.google.androidbrowserhelper.trusted.LauncherActivity

class MainActivity : LauncherActivity() {
    override fun getLaunchingUrl(): Uri = Uri.parse(PWA_URL)

    companion object {
        const val PWA_URL = "https://carouan.github.io/TEC_Widget/"
    }
}
