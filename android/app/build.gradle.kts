plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "be.carouan.tecwidget"
    compileSdk = 35

    defaultConfig {
        applicationId = "be.carouan.tecwidget"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
