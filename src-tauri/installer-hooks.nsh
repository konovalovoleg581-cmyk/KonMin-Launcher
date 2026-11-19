!include LogicLib.nsh

!ifdef MAINBINARYNAME
  !define KONMIN_MAIN_EXE "${MAINBINARYNAME}.exe"
!else
  !define KONMIN_MAIN_EXE "konmin-launcher.exe"
!endif

!define KONMIN_ASIDE ".konmin-old"

Var KonMinAttempt
Var KonMinProbe
Var KonMinAside
Var KonMinExitCode
Var KonMinGameRoot
Var KonMinIndex
Var KonMinName
Var KonMinPrefix
Var KonMinLen
Var KonMinWipe
Var KonMinFind
Var KonMinEntry
Var KonMinWv2
Var KonMinWv2Find
Var KonMinWv2Entry

; NSIS aborts the install with "Error opening file for writing" whenever the
; target is still held: the app running from the tray, an elevated instance the
; per-user installer may not terminate, a virus scanner reading the previous
; build, or a read-only attribute left by one of them. Retrying opens the same
; handle and fails again, so the file is freed here instead: attributes cleared,
; the app asked to quit, then forced, and as a last resort the locked file is
; renamed aside — Windows allows renaming a running image — and removed on the
; next reboot. The installer writes a fresh binary either way.
!macro KonMinFreeFile _file
  ${If} ${FileExists} "${_file}"
    SetFileAttributes "${_file}" NORMAL
    StrCpy $KonMinAttempt 0
    ${Do}
      ClearErrors
      FileOpen $KonMinProbe "${_file}" a
      ${IfNot} ${Errors}
        FileClose $KonMinProbe
        ${Break}
      ${EndIf}
      ${If} $KonMinAttempt == 0
        nsExec::Exec 'taskkill /IM "${KONMIN_MAIN_EXE}"'
        Pop $KonMinExitCode
      ${ElseIf} $KonMinAttempt == 2
        nsExec::Exec 'taskkill /F /IM "${KONMIN_MAIN_EXE}"'
        Pop $KonMinExitCode
      ${ElseIf} $KonMinAttempt == 4
        StrCpy $KonMinAside "${_file}${KONMIN_ASIDE}"
        Delete "$KonMinAside"
        ClearErrors
        Rename "${_file}" "$KonMinAside"
        ${IfNot} ${Errors}
          Delete /REBOOTOK "$KonMinAside"
          ${Break}
        ${EndIf}
      ${ElseIf} $KonMinAttempt == 5
        StrCpy $KonMinAside "${_file}${KONMIN_ASIDE}2"
        Delete "$KonMinAside"
        ClearErrors
        Rename "${_file}" "$KonMinAside"
        ${IfNot} ${Errors}
          Delete /REBOOTOK "$KonMinAside"
        ${EndIf}
        ${Break}
      ${EndIf}
      Sleep 600
      IntOp $KonMinAttempt $KonMinAttempt + 1
    ${Loop}
  ${EndIf}
!macroend

!macro KonMinFreeInstallDir
  !insertmacro KonMinFreeFile "$INSTDIR\${KONMIN_MAIN_EXE}"
  !insertmacro KonMinFreeFile "$INSTDIR\WebView2Loader.dll"
  !insertmacro KonMinFreeFile "$INSTDIR\uninstall.exe"
!macroend

; WebView2 Runtime. Tauri's own section (webviewInstallMode) looked at one registry
; value only and aborted the WHOLE install when it could not download or run
; Microsoft's installer: players with a working runtime whose registration was
; trimmed (Edge removal scripts, «lite» Windows builds, cleaners) got «Failed to
; install WebView2» and no launcher at all. It is off (tauri.conf.json: skip) and
; done here: any registration naming a real version counts, files on disk save a
; failed repair from a false alarm, and a failure never stops the install. A
; launcher that then cannot open its window says so itself (engine/core/crash.rs).
!define KONMIN_WV2_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define KONMIN_WV2_CLIENT "Microsoft\EdgeUpdate\Clients\${KONMIN_WV2_GUID}"
!define KONMIN_WV2_URL "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
!define KONMIN_WV2_PAGE "https://developer.microsoft.com/microsoft-edge/webview2/"

; A version in the registration; «0.0.0.0» is what Microsoft writes for «not installed».
!macro KonMinWv2Version _root _key
  ${If} $KonMinWv2 == ""
  ${OrIf} $KonMinWv2 == "0.0.0.0"
    ReadRegStr $KonMinWv2 ${_root} "${_key}" "pv"
  ${EndIf}
!macroend

; $KonMinWv2Entry = "1" when msedgewebview2.exe is in a version folder under _dir.
!macro KonMinWv2Files _dir
  ${If} $KonMinWv2Entry != "1"
    ClearErrors
    FindFirst $KonMinWv2Find $KonMinWv2 "${_dir}\*"
    ${DoUntil} ${Errors}
      ${If} $KonMinWv2 != "."
      ${AndIf} $KonMinWv2 != ".."
      ${AndIf} ${FileExists} "${_dir}\$KonMinWv2\msedgewebview2.exe"
        StrCpy $KonMinWv2Entry "1"
        ${Break}
      ${EndIf}
      ClearErrors
      FindNext $KonMinWv2Find $KonMinWv2
    ${Loop}
    FindClose $KonMinWv2Find
  ${EndIf}
!macroend

!macro KonMinEnsureWebView2
  ${If} $UpdateMode <> 1
    StrCpy $KonMinWv2 ""
    !insertmacro KonMinWv2Version HKLM "SOFTWARE\WOW6432Node\${KONMIN_WV2_CLIENT}"
    !insertmacro KonMinWv2Version HKLM "SOFTWARE\${KONMIN_WV2_CLIENT}"
    !insertmacro KonMinWv2Version HKCU "SOFTWARE\${KONMIN_WV2_CLIENT}"
    ${If} $KonMinWv2 == ""
    ${OrIf} $KonMinWv2 == "0.0.0.0"
      DetailPrint "WebView2 Runtime is not registered, installing it"
      InitPluginsDir
      Delete "$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe"
      ; urlmon speaks HTTPS and follows the system proxy; NSISdl is the fallback.
      System::Call 'urlmon::URLDownloadToFileW(p 0, w "${KONMIN_WV2_URL}", w "$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe", i 0, p 0) i .s'
      Pop $KonMinExitCode
      ${IfNot} ${FileExists} "$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe"
        NSISdl::download "${KONMIN_WV2_URL}" "$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe"
        Pop $KonMinExitCode
      ${EndIf}
      StrCpy $KonMinExitCode "1"
      ${If} ${FileExists} "$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe"
        ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $KonMinExitCode
      ${EndIf}
      ${If} $KonMinExitCode = 0
        DetailPrint "WebView2 Runtime installed"
      ${Else}
        DetailPrint "WebView2 Runtime was not installed (code $KonMinExitCode), the launcher install goes on"
        StrCpy $KonMinWv2Entry ""
        !insertmacro KonMinWv2Files "$PROGRAMFILES32\Microsoft\EdgeWebView\Application"
        !insertmacro KonMinWv2Files "$PROGRAMFILES64\Microsoft\EdgeWebView\Application"
        !insertmacro KonMinWv2Files "$LOCALAPPDATA\Microsoft\EdgeWebView\Application"
        ; The runtime is on disk: the repair failed, the launcher will most likely open anyway.
        ${If} $KonMinWv2Entry != "1"
        ${AndIfNot} ${Silent}
        ${AndIf} $PassiveMode <> 1
          ${If} $LANGUAGE = 1049
            MessageBox MB_YESNO|MB_ICONEXCLAMATION "Не удалось установить компонент Microsoft WebView2 — без него окно лаунчера не откроется. Установка лаунчера продолжится.$\n$\nОткрыть страницу WebView2, чтобы поставить его вручную?" IDNO konmin_wv2_done
          ${Else}
            MessageBox MB_YESNO|MB_ICONEXCLAMATION "Microsoft WebView2 could not be installed, and the launcher window will not open without it. The launcher install goes on.$\n$\nOpen the WebView2 page to install it by hand?" IDNO konmin_wv2_done
          ${EndIf}
          ExecShell "open" "${KONMIN_WV2_PAGE}"
          konmin_wv2_done:
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro KonMinFreeInstallDir
  !insertmacro KonMinEnsureWebView2
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Delete /REBOOTOK "$INSTDIR\*${KONMIN_ASIDE}*"
!macroend

; The game folder the player picked lives in game-root.txt inside the app data,
; read before the uninstall removes anything.
!macro KonMinReadGameRoot
  SetShellVarContext current
  StrCpy $KonMinGameRoot ""
  ClearErrors
  FileOpen $KonMinProbe "$APPDATA\com.konmin.launcher\game-root.txt" r
  ${IfNot} ${Errors}
    FileRead $KonMinProbe $KonMinGameRoot
    FileClose $KonMinProbe
  ${EndIf}
  ; Trim the line break.
  ${Do}
    StrCpy $KonMinName $KonMinGameRoot 1 -1
    ${If} $KonMinName == "$\r"
    ${OrIf} $KonMinName == "$\n"
      StrCpy $KonMinGameRoot $KonMinGameRoot -1
    ${Else}
      ${Break}
    ${EndIf}
  ${Loop}
!macroend

; Graphics card choices the launcher wrote for its own java (engine/game/gpu.rs) are
; values named by the java path under UserGpuPreferences: remove the ones under
; _prefix only. Deleting shifts the index, so it only moves on a kept value.
!macro KonMinDropGpuPrefs _prefix
  StrCpy $KonMinPrefix "${_prefix}"
  StrLen $KonMinLen $KonMinPrefix
  ${If} $KonMinLen > 3
    StrCpy $KonMinIndex 0
    ${Do}
      ClearErrors
      EnumRegValue $KonMinName HKCU "Software\Microsoft\DirectX\UserGpuPreferences" $KonMinIndex
      ${If} ${Errors}
      ${OrIf} $KonMinName == ""
        ${Break}
      ${EndIf}
      StrCpy $KonMinProbe $KonMinName $KonMinLen
      ${If} $KonMinProbe == $KonMinPrefix
        DeleteRegValue HKCU "Software\Microsoft\DirectX\UserGpuPreferences" $KonMinName
      ${Else}
        IntOp $KonMinIndex $KonMinIndex + 1
      ${EndIf}
    ${Loop}
  ${EndIf}
!macroend

; Empties _dir except the entries named _keep1/_keep2/_keep3 («-» keeps nothing more).
!macro KonMinWipeDirExcept _dir _keep1 _keep2 _keep3
  ClearErrors
  FindFirst $KonMinFind $KonMinEntry "${_dir}\*"
  ${DoUntil} ${Errors}
    ${If} $KonMinEntry != "."
    ${AndIf} $KonMinEntry != ".."
    ${AndIf} $KonMinEntry != "${_keep1}"
    ${AndIf} $KonMinEntry != "${_keep2}"
    ${AndIf} $KonMinEntry != "${_keep3}"
      ${If} ${FileExists} "${_dir}\$KonMinEntry\*"
        RmDir /r "${_dir}\$KonMinEntry"
      ${Else}
        Delete "${_dir}\$KonMinEntry"
      ${EndIf}
    ${EndIf}
    ClearErrors
    FindNext $KonMinFind $KonMinEntry
  ${Loop}
  FindClose $KonMinFind
!macroend

; The «delete app data» box stands for accounts, settings and caches, but Tauri's own
; handling removes the whole app data folder, and with it the default game folder:
; a player reinstalling the launcher lost builds and worlds played for weeks. The
; box is taken over before Tauri acts on it and the same folders are emptied here,
; keeping the builds (minecraft\profiles), their list and the pointer to a game
; folder picked by hand. The launcher adopts kept build folders on the next start.
!macro KonMinWipeKeepingBuilds _roaming _local
  RmDir /r "${_local}"
  !insertmacro KonMinWipeDirExcept "${_roaming}" "minecraft" "profiles.json" "game-root.txt"
  !insertmacro KonMinWipeDirExcept "${_roaming}\minecraft" "profiles" "-" "-"
  RmDir "${_roaming}\minecraft"
  RmDir "${_roaming}"
!macroend

; What the uninstaller always removes, «delete app data» box or not: the WebView2
; caches (never the page's own storage), the autostart entries, the konmin:// link
; if it still points here and the GPU choices for our java. Accounts and settings
; stay unless the player ticks the box; builds and worlds stay always. The page keeps the
; account list, the statistics opt-out and its other settings in WebView2's Local
; Storage and IndexedDB, so those folders are left alone here. A game folder picked
; by hand is never removed — it may be shared with another launcher. Updates
; (/UPDATE) keep everything.
!macro KonMinCleanTraces
  ${If} $UpdateMode <> 1
    SetShellVarContext current
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\Default\Cache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\Default\Code Cache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\Default\GPUCache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\Default\DawnGraphiteCache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\Default\DawnWebGPUCache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\Default\Service Worker\CacheStorage"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\GrShaderCache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\GraphiteDawnCache"
    RmDir /r "$LOCALAPPDATA\com.konmin.launcher\EBWebView\ShaderCache"
    RmDir /r "$APPDATA\com.konmin.launcher\tmp"
    ; The notification id the launcher registers for toasts when there is no Start menu shortcut.
    DeleteRegKey HKCU "Software\Classes\AppUserModelId\com.konmin.launcher"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "KonMin Launcher"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "KonMin Launcher"
    ReadRegStr $KonMinName HKCU "Software\Classes\konmin\shell\open\command" ""
    StrCpy $KonMinPrefix "$\"$INSTDIR\${KONMIN_MAIN_EXE}$\""
    StrLen $KonMinLen $KonMinPrefix
    StrCpy $KonMinProbe $KonMinName $KonMinLen
    ${If} $KonMinProbe == $KonMinPrefix
      DeleteRegKey HKCU "Software\Classes\konmin"
    ${EndIf}
    !insertmacro KonMinDropGpuPrefs "$APPDATA\com.konmin.launcher\"
    ${If} $KonMinGameRoot != ""
      ; Only the launcher's own java folder: a shared root such as D:\Games\ holds
      ; other launchers' java too, and their graphics choices are not ours to drop.
      !insertmacro KonMinDropGpuPrefs "$KonMinGameRoot\runtime\"
    ${EndIf}
  ${EndIf}
!macroend

; The report runs after the running launcher is closed: a heartbeat sent later
; would mark the install alive again on the server. The timeout keeps a hung
; network from holding the uninstall.
!macro NSIS_HOOK_PREUNINSTALL
  StrCpy $KonMinWipe 0
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    StrCpy $DeleteAppDataCheckboxState 0
    StrCpy $KonMinWipe 1
  ${EndIf}
  !insertmacro KonMinReadGameRoot
  !insertmacro KonMinFreeInstallDir
  ${If} ${FileExists} "$INSTDIR\${KONMIN_MAIN_EXE}"
    nsExec::Exec /TIMEOUT=10000 '"$INSTDIR\${KONMIN_MAIN_EXE}" --report-uninstall'
    Pop $KonMinExitCode
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete /REBOOTOK "$INSTDIR\*${KONMIN_ASIDE}*"
  !insertmacro KonMinCleanTraces
  ${If} $KonMinWipe = 1
    SetShellVarContext current
    !insertmacro KonMinWipeKeepingBuilds "$APPDATA\com.konmin.launcher" "$LOCALAPPDATA\com.konmin.launcher"
  ${EndIf}
!macroend
