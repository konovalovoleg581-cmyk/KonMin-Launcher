package net.millida.launcher

import android.os.Looper
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.ViewModelProvider
import com.github.takahirom.roborazzi.captureRoboImage
import java.io.File
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * KonMin Launcher Mobile: pictures of the real app (MainActivity, the real view model) for review, the way the
 * upstream lobby shots are made. Runs only with -Pmillida.shots=<folder>:
 *
 *     ./gradlew :app:testDebugUnitTest --tests '*KonMinShotsTest*' -Pmillida.shots=shots
 *
 * It shows the first start without an account, then signs in an offline nick through the debug hook and opens
 * the six sections of the navigation rail one by one.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w873dp-h393dp-land-440dpi")
class KonMinShotsTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private fun settle(ms: Long = 1500) {
        repeat((ms / 100).toInt()) {
            shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(100))
            compose.mainClock.advanceTimeBy(100)
        }
        compose.waitForIdle()
    }

    @Test
    fun sections() {
        val out = System.getProperty("millida.shots")
        assumeTrue("pictures only with -Pmillida.shots", !out.isNullOrBlank())
        val folder = File(out!!, "konmin").apply { mkdirs() }
        compose.mainClock.autoAdvance = false
        settle(3000)
        compose.onRoot().captureRoboImage(File(folder, "00-first-start.png").absolutePath)

        val model = ViewModelProvider(compose.activity)[LauncherViewModel::class.java]
        compose.runOnUiThread { model.debugSignInOffline("KonMinPlayer") }
        settle(3000)
        val sections = listOf(Screen.HOME, Screen.VERSIONS, Screen.CATALOG, Screen.SERVERS, Screen.SKINS, Screen.SETTINGS)
        sections.forEachIndexed { index, screen ->
            compose.runOnUiThread { model.open(screen) }
            settle(2500)
            compose.onRoot().captureRoboImage(File(folder, "%02d-%s.png".format(index + 1, screen.name.lowercase())).absolutePath)
        }
    }
}
