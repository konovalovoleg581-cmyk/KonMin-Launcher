package net.millida.launcher.core

import java.io.IOException
import net.millida.launcher.core.i18n.tr

/**
 * KonMin Launcher Mobile: which online services this build may use. Filled once per process by the
 * application (MillidaApp.onCreate) from BuildConfig, before anything touches the network.
 *
 * Millida's servers belong to a third party. While [millidaServices] is off, the shared HTTP client
 * refuses every Millida host (see [Downloader.defaultClient]), so the launcher never sends a request
 * there, and the features that need them say that they are off instead of failing at random.
 */
object KonMinConfig {
    /** Manifest of a KonMin-hosted runtime pack; empty when the pack comes bundled or imported only. */
    @Volatile
    var runtimeManifestUrl: String = ""

    /** Millida's account, friends, chat, shop, hosting, cloud and telemetry services. */
    @Volatile
    var millidaServices: Boolean = false

    private val MILLIDA_DOMAINS = listOf("millida.net", "millida.trade")

    fun isMillidaHost(host: String): Boolean {
        val h = host.lowercase().trimEnd('.')
        return MILLIDA_DOMAINS.any { h == it || h.endsWith(".$it") }
    }

    /** Thrown for a request to a Millida host while those services are off. An IOException, so callers treat it like no network. */
    class MillidaServicesOff(host: String) : IOException(
        tr("Сервисы Millida в KonMin Launcher отключены ({host})", host),
    )
}
