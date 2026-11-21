pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "konmin-launcher-mobile"

include(":core")
include(":runtime")
include(":app")
include(":bridge")
include(":processors")
