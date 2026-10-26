//! How to ask the operating system to show a file in its file manager.
//!
//! The desktop command spawns whatever this returns; keeping the decision here
//! means the platform differences are unit-testable, which they are not in the
//! Tauri-linked crate on every toolchain.
//!
//! Nothing in this module touches the file. It names a program and its
//! arguments — the caller hands them to the OS as argv elements, never through
//! a shell, so a path with spaces, quotes or backslashes stays one argument.

/// A program to run, and the arguments to hand it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RevealCommand {
    pub program: &'static str,
    pub args: Vec<String>,
}

/// The command that reveals `path` on `os` (a [`std::env::consts::OS`] value).
///
/// `None` means "there is nothing to run": an unrecognised platform, or a path
/// with no directory to open on Linux, where the file itself is not revealed
/// but its parent folder is.
pub fn reveal_command(os: &str, path: &str) -> Option<RevealCommand> {
    if path.trim().is_empty() {
        return None;
    }
    match os {
        // `/select,` and the path are one argument: explorer parses the verb
        // and its target together, and a separate argument is dropped.
        "windows" => Some(RevealCommand {
            program: "explorer",
            args: vec![format!("/select,{path}")],
        }),
        "macos" => Some(RevealCommand {
            program: "open",
            args: vec!["-R".to_string(), path.to_string()],
        }),
        "linux" => std::path::Path::new(path)
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .map(|dir| RevealCommand {
                program: "xdg-open",
                args: vec![dir.to_string_lossy().into_owned()],
            }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_selects_the_file_in_explorer() {
        // `/select,` has to be *attached* to the path: as two arguments
        // explorer opens a default folder and ignores the selection, which is
        // the bug this shape is here to avoid.
        let command = reveal_command("windows", r"C:\Music\Track.mp3").unwrap();
        assert_eq!(command.program, "explorer");
        assert_eq!(
            command.args,
            vec![r#"/select,C:\Music\Track.mp3"#.to_string()]
        );
    }

    #[test]
    fn a_windows_path_with_spaces_stays_one_argument() {
        let path = r"C:\My Music\Long Version (Live).mp3";
        let command = reveal_command("windows", path).unwrap();
        assert_eq!(command.args.len(), 1);
        assert_eq!(command.args[0], format!("/select,{path}"));
    }

    #[test]
    fn macos_reveals_with_open() {
        let command = reveal_command("macos", "/Users/dj/Music/Track.mp3").unwrap();
        assert_eq!(command.program, "open");
        assert_eq!(
            command.args,
            vec!["-R".to_string(), "/Users/dj/Music/Track.mp3".to_string()]
        );
    }

    #[test]
    fn linux_opens_the_parent_directory() {
        // `xdg-open` has no reveal-a-file verb, so the folder is the best
        // available answer — and the folder is named, not the file.
        let command = reveal_command("linux", "/home/dj/Music/Track.mp3").unwrap();
        assert_eq!(command.program, "xdg-open");
        assert_eq!(command.args, vec!["/home/dj/Music".to_string()]);
    }

    #[test]
    fn a_linux_path_with_no_parent_has_nothing_to_open() {
        assert_eq!(reveal_command("linux", "Track.mp3"), None);
    }

    #[test]
    fn an_unknown_platform_runs_nothing() {
        assert_eq!(reveal_command("netbsd", "/usr/Track.mp3"), None);
    }

    #[test]
    fn an_empty_path_runs_nothing() {
        // The scanner only stores absolute paths today, but a blank one must
        // not turn into `xdg-open <cwd>` or an explorer window on a default
        // folder.
        assert_eq!(reveal_command("windows", ""), None);
        assert_eq!(reveal_command("macos", ""), None);
        assert_eq!(reveal_command("linux", ""), None);
    }
}
