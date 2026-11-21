package net.millida.launcher.ui

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import net.millida.launcher.LauncherViewModel
import net.millida.launcher.UiState
import net.millida.launcher.core.i18n.tr
import net.millida.launcher.core.loader.LoaderKind
import net.millida.launcher.core.profile.Profile

/**
 * KonMin Launcher Mobile, «Версии»: every installed instance with its Minecraft version and loader, and a new one
 * in a couple of taps. Nothing here is a mock: creating goes through [LauncherViewModel.createProfile] (the same
 * version list and Fabric / Quilt / Forge / NeoForge choice as the lobby), a row opens the instance page with its
 * mods, worlds, servers and options ([LauncherViewModel.openBuild]), and «Играть» installs and starts it.
 */
@Composable
fun VersionsScreen(state: UiState, model: LauncherViewModel, modifier: Modifier = Modifier) {
    val lobby by model.lobby.state.collectAsStateWithLifecycle()
    var creating by rememberSaveable { mutableStateOf(false) }
    var deleting by rememberSaveable { mutableStateOf<String?>(null) }
    val sorted = remember(state.profiles) { state.profiles.sortedByDescending { it.lastPlayedAt } }
    val idle = state.busy == null

    MScreen(modifier = modifier, title = tr("Версии"), subtitle = tr("Сборки на этом телефоне: версия Minecraft и загрузчик")) {
        state.busy?.let { task ->
            item(key = "busy") {
                MBusyCard(label = task, progress = state.progress.takeIf { it > 0f }, note = state.progressNote.ifEmpty { null })
            }
        }
        item(key = "new") {
            MPrimaryButton(tr("Новая сборка"), onClick = { creating = true }, enabled = idle, icon = MIcons.plus)
            Spacer(Modifier.height(4.dp))
        }
        if (sorted.isEmpty()) {
            item(key = "empty") {
                MEmptyState(
                    icon = MIcons.blocks,
                    title = tr("Сборок пока нет — создай первую: выбери версию Minecraft и загрузчик"),
                    actionText = tr("Новая сборка"),
                    onAction = { creating = true },
                )
            }
        } else {
            item(key = "title") { MSectionHeader(tr("Мои сборки")) }
            items(sorted, key = { it.id }) { profile ->
                VersionRow(
                    profile = profile,
                    active = profile.id == state.activeProfileId,
                    enabled = idle,
                    onOpen = { model.openBuild(profile) },
                    onPlay = {
                        model.selectBuild(profile)
                        model.play(profile)
                    },
                    onDelete = { deleting = profile.id },
                )
            }
        }
    }

    if (creating) {
        CreateProfileSheet(
            state = state,
            onDismiss = { creating = false },
            onCreate = { name, version, loader ->
                creating = false
                model.createProfile(name, version, loader)
            },
            versions = lobby.versions,
            versionsLoading = lobby.versionsLoading,
            versionsError = lobby.versionsError,
            onRetryVersions = model.lobby::retryVersions,
        )
    }

    val deletingProfile = state.profiles.firstOrNull { it.id == deleting }
    if (deletingProfile != null) {
        MConfirmDialog(
            title = tr("Удалить сборку?"),
            text = tr("«{name}» удалится с модами и мирами. Вернуть нельзя.", deletingProfile.name),
            confirm = tr("Удалить"),
            onConfirm = {
                deleting = null
                model.deleteProfile(deletingProfile.id)
            },
            onDismiss = { deleting = null },
        )
    }
}

@Composable
private fun VersionRow(
    profile: Profile,
    active: Boolean,
    enabled: Boolean,
    onOpen: () -> Unit,
    onPlay: () -> Unit,
    onDelete: () -> Unit,
) {
    val loader = if (profile.loader == LoaderKind.VANILLA) profile.loader.label else {
        profile.loader.label + (profile.loaderVersion.takeIf { it.isNotBlank() }?.let { " $it" } ?: "")
    }
    MListRow(
        title = profile.name,
        subtitle = "Minecraft ${profile.gameVersion} · $loader" + if (active) " · " + tr("выбрана") else "",
        icon = MIcons.blocks,
        onClick = onOpen,
        trailing = {
            MIconButton(MIcons.trash, onClick = onDelete, label = tr("Удалить"), enabled = enabled)
            MIconButton(MIcons.play, onClick = onPlay, label = tr("Играть"), enabled = enabled)
        },
    )
}
