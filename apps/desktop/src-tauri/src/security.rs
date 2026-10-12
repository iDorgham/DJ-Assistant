use std::path::{Path, PathBuf};

/// Validates and canonicalizes a path, ensuring it is a valid directory and prevents basic path traversal.
pub fn validate_and_canonicalize_dir(raw_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", raw_path));
    }

    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    if !canonical.is_dir() {
        return Err(format!("Path is not a directory: {}", canonical.display()));
    }

    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_dir() {
        let current_dir = std::env::current_dir().unwrap();
        let res = validate_and_canonicalize_dir(current_dir.to_str().unwrap());
        assert!(res.is_ok());
    }

    #[test]
    fn test_non_existent_dir() {
        let res = validate_and_canonicalize_dir("some_non_existent_folder_xyz_123");
        assert!(res.is_err());
    }
}
