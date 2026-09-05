/// Kiosk / lockdown helpers.
///
/// Shared entry point is [`set_kiosk`], which toggles fullscreen + alwaysOnTop.
/// OS-specific hardening below is intentionally best-effort stubs: a userspace
/// exam client can never fully lock down the OS (see Windows note).
pub fn set_kiosk(window: &tauri::Window, locked: bool) -> Result<(), String> {
    window.set_fullscreen(locked).map_err(|e| e.to_string())?;
    window
        .set_always_on_top(locked)
        .map_err(|e| e.to_string())?;

    if locked {
        // Best-effort: keep focus while locked; ignore errors (window may be closing).
        let _ = window.set_focus();
    }

    #[cfg(target_os = "windows")]
    apply_windows_lockdown(locked);

    #[cfg(target_os = "macos")]
    apply_macos_lockdown(locked);

    #[cfg(target_os = "linux")]
    apply_linux_lockdown(locked);

    Ok(())
}

/// Windows hardening (stub).
///
/// TODO: install a low-level keyboard hook (`WH_KEYBOARD_LL` via `SetWindowsHookEx`)
/// to swallow Win keys, Alt+Tab, Alt+F4, Ctrl+Shift+Esc, etc. while `locked`,
/// and uninstall it when unlocked.
///
/// NOTE (best-effort only): `Ctrl+Alt+Del` (Secure Attention Sequence) is
/// handled by Winlogon at a higher privilege level and **cannot** be blocked
/// from userspace. Full lockdown requires Group Policy / Assigned Access /
/// kiosk mode, not just this hook.
#[cfg(target_os = "windows")]
fn apply_windows_lockdown(locked: bool) {
    // TODO: SetWindowsHookEx(WH_KEYBOARD_LL, ...) when locked; UnhookWindowsHookEx when unlocked.
    let _ = locked;
}

/// macOS hardening (stub).
///
/// TODO: set `NSApplication` presentation options
/// (`NSApplicationPresentationHideDock | NSApplicationPresentationHideMenuBar |
/// NSApplicationPresentationDisableProcessSwitching | ...`) while locked,
/// and restore defaults on unlock.
#[cfg(target_os = "macos")]
fn apply_macos_lockdown(locked: bool) {
    // TODO: NSApplication presentationOptions via objc2-app-kit.
    let _ = locked;
}

/// Linux hardening (stub).
///
/// TODO: grab keyboard/pointer (`XGrabKeyboard` on X11, layer-shell kiosk on
/// Wayland compositors that support it) while locked, and ungrab on unlock.
/// Wayland compositors generally ignore client-side grabs, so this is
/// compositor-dependent and best-effort.
#[cfg(target_os = "linux")]
fn apply_linux_lockdown(locked: bool) {
    // TODO: XGrabKeyboard / zwlr_layer_shell kiosk grab.
    let _ = locked;
}
