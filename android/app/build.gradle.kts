import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val versionProperties = Properties().apply {
    rootProject.file("version.properties").inputStream().use(::load)
}
val appVersionName = versionProperties.getProperty("VERSION_NAME")
    ?: error("VERSION_NAME is missing from android/version.properties")
val appVersionCode = versionProperties.getProperty("VERSION_CODE")?.toIntOrNull()
    ?: error("VERSION_CODE must be an integer in android/version.properties")

val releaseRequested = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
val releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")

if (releaseRequested) {
    val missing = listOf(
        "ANDROID_KEYSTORE_PATH" to releaseKeystorePath,
        "ANDROID_KEYSTORE_PASSWORD" to releaseKeystorePassword,
        "ANDROID_KEY_ALIAS" to releaseKeyAlias,
        "ANDROID_KEY_PASSWORD" to releaseKeyPassword,
    ).filter { it.second.isNullOrBlank() }.map { it.first }
    check(missing.isEmpty()) {
        "Release signing is not configured. Missing environment variables: ${missing.joinToString(", ")}"
    }
}

android {
    namespace = "be.carouan.tecwidget"
    compileSdk = 35

    defaultConfig {
        applicationId = "be.carouan.tecwidget"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        if (releaseKeystorePath != null && releaseKeystorePassword != null && releaseKeyAlias != null && releaseKeyPassword != null) {
            create("release") {
                storeFile = file(releaseKeystorePath)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.2") {
        exclude(group = "androidx.browser", module = "browser")
    }
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
}
