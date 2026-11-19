//! System tray: a minimal Show/Quit tray whose glyph follows the OS theme.
//! OS bundle icons (.ico/.icns) cannot theme-switch, so the tray swaps between
//! two embedded PNG glyphs instead.

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Theme};

pub const TRAY_ID: &str = "main";

const TRAY_ON_DARK: &[u8] = include_bytes!("../icons/tray-on-dark.png");
const TRAY_ON_LIGHT: &[u8] = include_bytes!("../icons/tray-on-light.png");

/// Tray glyph file name for the given OS theme.
pub fn tray_icon_name(theme: Theme) -> &'static str {
    match theme {
        Theme::Light => "tray-on-light.png",
        _ => "tray-on-dark.png",
    }
}

/// Embedded tray glyph for the given OS theme.
pub fn tray_icon_image(theme: Theme) -> tauri::Result<Image<'static>> {
    let bytes = match theme {
        Theme::Light => TRAY_ON_LIGHT,
        _ => TRAY_ON_DARK,
    };
    Image::from_bytes(bytes)
}

/// Build the tray with its Show/Quit menu; left-click shows the main window.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show DJ Assistant", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let theme = app
        .get_webview_window("main")
        .and_then(|window| window.theme().ok())
        .unwrap_or(Theme::Dark);
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tray_icon_image(theme)?)
        .tooltip("DJ Assistant")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Swap the tray glyph when the OS theme changes.
pub fn apply_theme(app: &AppHandle, theme: Theme) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(image) = tray_icon_image(theme) {
            let _ = tray.set_icon(Some(image));
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_glyph_follows_the_os_theme() {
        assert_eq!(tray_icon_name(Theme::Light), "tray-on-light.png");
        assert_eq!(tray_icon_name(Theme::Dark), "tray-on-dark.png");
    }

    #[test]
    fn tray_glyphs_are_embedded_32px_pngs() {
        for theme in [Theme::Dark, Theme::Light] {
            let image = tray_icon_image(theme).expect("embedded tray glyph decodes");
            assert_eq!(image.width(), 32);
            assert_eq!(image.height(), 32);
            assert!(!image.rgba().is_empty());
        }
    }
}
