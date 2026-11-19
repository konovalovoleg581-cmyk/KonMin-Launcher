import { create } from 'zustand'
import { readPref, writePref } from '../lib/prefs'
import { isGameAccountKind, useAccounts } from './accounts'

const KEY = 'm-first-run'
const DONE = '1'
const GAME_STEP = 'game'

export const useFirstRun = create<{ open: boolean }>(() => ({ open: false }))

export const firstRunDone = (): boolean => readPref(KEY, '') === DONE

export const gameStepPending = (): boolean => readPref(KEY, '') === GAME_STEP

export const hasGameAccount = (): boolean => useAccounts.getState().list.some((a) => isGameAccountKind(a.kind))

/// Right after a Millida sign-in a new player adds a licence or an offline nick to
/// play with: the Millida login itself is no longer handed out as a game account.
/// A player who signed in to Millida before keeps playing as they did; a step left
/// unfinished comes back even though that sign-in already marked them as returning.
export function gameStepDue(o: { returning: boolean; state: string; hasGame: boolean }): boolean {
  if (o.hasGame) return false
  if (o.state === GAME_STEP) return true
  return !o.returning && o.state !== DONE
}

export function startGameStep() {
  writePref(KEY, GAME_STEP)
  useFirstRun.setState({ open: true })
}

export function finishFirstRun() {
  writePref(KEY, DONE)
  useFirstRun.setState({ open: false })
}

export const firstRunState = (): string => readPref(KEY, '')

const GUEST_KEY = 'm-konmin-guest'

/// KonMin Launcher: a player may skip the Millida sign-in and play with a Microsoft licence or an offline
/// nick only. Upstream lets nobody in without a Millida account; a fork cannot rely on a third party's
/// service to open at all, so the choice is remembered and the next start goes straight to the lobby.
/// Millida features (friends, catalog purchases, cosmetics) still ask for a Millida sign-in where they need it.
export const konminGuest = (): boolean => readPref(GUEST_KEY, '') === '1'

/// Returns true when the player already has a game account and can go straight back to the lobby (the sign-in
/// screen was opened from a Millida feature); otherwise the game-account step opens.
export function playWithoutMillida(): boolean {
  writePref(GUEST_KEY, '1')
  if (hasGameAccount()) return true
  startGameStep()
  return false
}

/// «Назад» from the game-account step of a guest: back to the Millida sign-in, nothing remembered.
export function leaveGuestStep() {
  writePref(GUEST_KEY, '')
  writePref(KEY, '')
  useFirstRun.setState({ open: false })
}
