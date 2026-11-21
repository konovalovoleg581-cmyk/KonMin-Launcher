package net.millida.launcher.core

import net.millida.launcher.core.catalog.ModrinthCatalog
import net.millida.launcher.core.http.Downloader
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** A request that leaves as "okhttp/x.y.z" looks to a server like any Android application. */
class UserAgentTest {

    private val server = MockWebServer()

    @Before
    fun start() = server.start()

    @After
    fun stop() = server.shutdown()

    private fun sent(explicit: String?): String? {
        server.enqueue(MockResponse().setBody("ok"))
        val request = Request.Builder().url("http://127.0.0.1:${server.port}/mod/variants.json").apply {
            if (explicit != null) header("User-Agent", explicit)
        }.build()
        Downloader.defaultClient().newCall(request).execute().close()
        return server.takeRequest().getHeader("User-Agent")
    }

    /** What the request names itself → what the server must read → why the case is pinned. */
    private val cases = listOf(
        Triple(null, Downloader.USER_AGENT, "без своего имени лаунчер неотличим от чужого приложения"),
        Triple(ModrinthCatalog.USER_AGENT, ModrinthCatalog.USER_AGENT, "каталог модов просит подписываться адресом для связи"),
    )

    @Test
    fun `запрос называет лаунчер, а заданное имя не перетирается`() {
        for ((explicit, expected, why) in cases) {
            assertEquals("User-Agent при заданном «$explicit»: $why", expected, sent(explicit))
        }
    }

    @Test
    fun `KonMin называет себя своим именем, а версия на настольную не похожа`() {
        val agent = Downloader.USER_AGENT
        assertTrue(
            "форк не представляется лаунчером Millida — серверы Millida не должны принимать его за свой: $agent",
            agent.startsWith("KonMinLauncher/") && !agent.startsWith("MillidaLauncher/"),
        )
        assertFalse(
            "по настольной версии из заголовка сервер предложит игру для компьютера, телефон её не запустит: $agent",
            Regex("^KonMinLauncher/\\d+\\.\\d+\\.\\d+(?:[\\s(]|$)").containsMatchIn(agent),
        )
        assertTrue(
            "версия сборки читается из заголовка: $agent",
            Regex("^KonMinLauncher/android-[0-9A-Za-z._-]+ \\(fork of Millida Launcher Mobile\\)$").matches(agent),
        )
    }
}
