package net.millida.launcher.ui

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import net.millida.launcher.LauncherViewModel
import net.millida.launcher.Screen
import net.millida.launcher.UiState
import net.millida.launcher.core.i18n.tr

/**
 * KonMin Launcher Mobile, «Серверы» without Millida services. Upstream this screen is Millida's server rating,
 * which lives on Millida's API; here it offers what works on its own: joining any server by its address with
 * the selected instance ([LauncherViewModel.playOnAddress] picks the version, Bedrock addresses go to Bedrock),
 * and the instance's own server list (servers.dat) on its page.
 */
@Composable
internal fun ServersWithoutRating(state: UiState, model: LauncherViewModel, modifier: Modifier = Modifier) {
    val colors = millida
    var address by rememberSaveable { mutableStateOf("") }
    val join: () -> Unit = {
        val typed = address.trim()
        if (typed.isNotEmpty() && state.busy == null) model.playOnAddress(typed, typed)
    }
    val selected = state.profiles.firstOrNull { it.id == state.activeProfileId } ?: state.profiles.firstOrNull()

    MScreen(modifier = modifier, title = tr("Серверы"), onBack = { model.back() }) {
        item(key = "join-title") { MSectionHeader(tr("Подключиться по адресу")) }
        item(key = "join") {
            MCard {
                MField(
                    value = address,
                    onValueChange = { address = it },
                    placeholder = tr("Адрес, например play.example.com"),
                    imeAction = ImeAction.Go,
                    onImeAction = join,
                    leadingIcon = MIcons.server,
                    clearable = true,
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    selected?.let { tr("Игра зайдёт со сборкой «{name}» ({version})", it.name, it.gameVersion) }
                        ?: tr("Сначала создай сборку — в неё и зайдёт игра"),
                    style = MillidaType.small,
                    color = colors.fgSubtle,
                )
                Spacer(Modifier.height(12.dp))
                MPrimaryButton(tr("Подключиться"), onClick = join, enabled = address.isNotBlank() && state.busy == null, icon = MIcons.play)
            }
        }
        item(key = "own") {
            MListRow(
                title = tr("Серверы сборки"),
                subtitle = tr("Список серверов каждой сборки — на её странице во вкладке «Серверы»"),
                icon = MIcons.blocks,
                onClick = { model.open(Screen.VERSIONS) },
            )
        }
        item(key = "rating-off") {
            MCard {
                Text(
                    tr("Рейтинг серверов работает на серверах Millida — в KonMin Launcher он пока отключён"),
                    style = MillidaType.small,
                    color = colors.fgSubtle,
                )
            }
        }
    }
}
