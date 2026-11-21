package net.millida.launcher.core

import java.nio.file.Files
import net.millida.launcher.core.http.Downloader
import net.millida.launcher.core.telemetry.TelemetryStore
import okhttp3.Request
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KonMinConfigTest {
    @After
    fun reset() {
        KonMinConfig.millidaServices = false
    }

    @Test
    fun `millida hosts are recognised by domain, not by substring`() {
        assertTrue(KonMinConfig.isMillidaHost("api.millida.net"))
        assertTrue(KonMinConfig.isMillidaHost("millida.net"))
        assertTrue(KonMinConfig.isMillidaHost("cdn.millida.trade"))
        assertTrue(KonMinConfig.isMillidaHost("API.Millida.NET."))
        assertFalse(KonMinConfig.isMillidaHost("api.modrinth.com"))
        assertFalse(KonMinConfig.isMillidaHost("millida.net.evil.com"))
        assertFalse(KonMinConfig.isMillidaHost("notmillida.net"))
    }

    @Test
    fun `with millida services off the shared client never sends a request to a millida host`() {
        KonMinConfig.millidaServices = false
        val error = runCatching {
            Downloader.defaultClient().newCall(Request.Builder().url("https://api.millida.net/v2/launcher/ping").build()).execute()
        }.exceptionOrNull()
        assertTrue("blocked before any connection: $error", error is KonMinConfig.MillidaServicesOff)
    }

    @Test
    fun `usage statistics are never recorded while millida services are off`() {
        val dir = Files.createTempDirectory("konmin-telemetry").toFile()
        try {
            KonMinConfig.millidaServices = false
            assertFalse("statistics would go to Millida's servers", TelemetryStore(dir).enabled)
        } finally {
            dir.deleteRecursively()
        }
    }
}
