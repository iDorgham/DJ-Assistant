# DJ Assistant — Windows Native Build Runbook

**Audience:** Engineers setting up the Windows desktop environment for local compilation.  
**Related Spec:** `docs/engineering/DEVELOPMENT.md`, `docs/ADR/0002-monorepo-layout.md`, `docs/sdd/05-ACCEPTANCE.md`.

---

## 1. Prerequisites & Toolchain Overrides

Compiling Tauri v2 on Windows requires:
- **Rust Toolchain:** `stable-x86_64-pc-windows-msvc` (recommended; see §1.1 for the GNU fallback)
- **MSVC Linker & C++ Build Tools:** Visual Studio 2022 C++ Build Tools (specifically `link.exe`, `cl.exe`, and Windows SDK)
- **Node.js & pnpm:** Node 20/22+ and pnpm 10+
- **WebView2:** Installed by default on modern Windows 10/11

### 1.1 Toolchain Reality Check (read before you start)

Two environment facts have already broken builds on real developer machines. Check both first.

**(a) The GNU toolchain cannot link the Tauri desktop binary correctly.**
`stable-x86_64-pc-windows-gnu` builds the app, but its test harness fails to load with
`STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139)` when resolving the WebView2 imports. The GNU
`ld` also rejects the `cdylib` crate type with `export ordinal too large`. MSVC is the
supported path.

```powershell
rustup toolchain list
rustc -vV                 # check the `host:` line - must be ...-msvc
```

If the active toolchain is GNU (or `x86_64-pc-windows-msvc` is not installed), install it:

```powershell
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
```

Verify the C++ tools actually exist — an empty `Microsoft Visual Studio` folder is a
common broken-install symptom, and `rustc` will not find a linker:

```powershell
Get-ChildItem "C:\Program Files\Microsoft Visual Studio" -Recurse -Filter cl.exe
Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -ErrorAction SilentlyContinue
```

**(b) A space in the repository path breaks `windres` on the GNU toolchain.**
`windres` splits unquoted `-I` paths, so a checkout under e.g.
`D:\Work\AI\Projects\DJ Assistant` fails with:

```
cc1.exe: fatal error: Assistant\target\debug\build\...\out: No such file or directory
windres: preprocessing failed.
```

Cargo resolves `CARGO_TARGET_DIR` to an absolute path, so the build output lands under the
space-containing root even if it is set to a relative path. Two fixes:

1. Use the MSVC toolchain (preferred — MSVC's `rc.exe` handles spaces), **or**
2. Point the target directory at a space-free path:

```powershell
# Current session
$env:CARGO_TARGET_DIR = "D:\cargo-target"

# Or persistently for your user account
[Environment]::SetEnvironmentVariable("CARGO_TARGET_DIR", "D:\cargo-target", "User")
```

> **Note:** this repository's `.gitignore` ignores `target/`, so a relocated target
> directory does not pollute the worktree. `cargo clean` will not remove it — delete
> `D:\cargo-target` manually if you need to reclaim space.

### Redirecting Cargo & Rustup Storage (Conserving C: Space)
If drive `C:` has limited capacity, you can redirect the package cache, toolchains, and download caches to another drive (e.g., `D:\.cargo` and `D:\.rustup`):

```powershell
# Set environment variables for current session (or permanently in System Properties)
$env:CARGO_HOME = "D:\.cargo"
$env:RUSTUP_HOME = "D:\.rustup"
$env:PATH = "$env:CARGO_HOME\bin;$env:PATH"

# To set permanently for your user account:
[Environment]::SetEnvironmentVariable("CARGO_HOME", "D:\.cargo", "User")
[Environment]::SetEnvironmentVariable("RUSTUP_HOME", "D:\.rustup", "User")
```

---

## 2. Visual Studio 2022 Build Tools (C++ Workload)

The native MSVC target requires the Visual Studio C++ compiler and linker (`link.exe`).

### Option A: Via winget (Recommended)
```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" --accept-package-agreements --accept-source-agreements
```

### Option B: Visual Studio Installer GUI
1. Download the [Visual Studio Build Tools Installer](https://aka.ms/vs/17/release/vs_BuildTools.exe).
2. Run the installer and check **Desktop development with C++** (includes MSVC v143 compiler, Windows 10/11 SDK, C++ CMake tools).
3. Ensure at least ~8–12 GB free space during installation.

---

## 3. Rust Toolchain Configuration

Once MSVC Build Tools are installed:

```powershell
# Ensure rustup uses the MSVC stable toolchain
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
```

Verify in PowerShell:
```powershell
cargo --version
rustc --version
where.exe link.exe
```

---

## 4. Building and Running the Desktop App

### Step 1: Rust Sanity Check
Run from the repository root (Cargo resolves the workspace automatically):
```powershell
cargo check
cargo test -p dj-assistant-schema-tests   # schema/query contracts; works on any toolchain
cargo test                                # requires MSVC - see §1.1a
```

### Step 2: Launch Tauri in Dev Mode
From the repository root:
```powershell
cd "d:\Work\AI\Projects\DJ Assistant"
pnpm dev:desktop
# Or directly via Tauri CLI:
pnpm --filter @dj-assistant/desktop tauri dev
```

### Step 3: Production Desktop Build
```powershell
pnpm --filter @dj-assistant/desktop tauri build
```
Since `Cargo.toml` declares a workspace at the repository root, Cargo writes build output to
the **workspace** target directory, not a crate-local one:

- Default: `target/release/`
- Or `%CARGO_TARGET_DIR%\release\` if that variable is set (see §1.1b)

The `.exe` and installer are produced under `bundle/` inside that directory.

---

## 5. Common Errors & Troubleshooting

| Error | Root Cause | Solution |
|---|---|---|
| `error: linker 'link.exe' not found` | MSVC C++ toolchain missing or not on PATH | Install VS 2022 Build Tools with C++ workload; launch from "x64 Native Tools Command Prompt" or verify SDK installed. |
| `icons/icon.ico not found; required for generating a Windows Resource file` | Tauri bundle icons missing from `src-tauri/icons/` | Regenerate with `pnpm --filter @dj-assistant/desktop exec tauri icon src-tauri/app-icon.png`. |
| `cc1.exe: fatal error: <path>: No such file or directory` + `windres: preprocessing failed` | Space in the repository path breaks `windres` (GNU toolchain only) | Switch to MSVC, or set a space-free `CARGO_TARGET_DIR` — see §1.1b. |
| `ld: error: export ordinal too large: 102402` | GNU `ld` cannot link the crate as a `cdylib` | Use MSVC. (`crate-type` is currently `["rlib"]`; re-add `cdylib` only for mobile targets on MSVC.) |
| Test binary exits `0xC0000139` (`STATUS_ENTRYPOINT_NOT_FOUND`) | GNU-built test harness cannot resolve WebView2 imports | Use MSVC. `cargo test -p dj-assistant-schema-tests` works on any toolchain because it does not link Tauri. |
| `There is not enough space on the disk. (os error 112)` | Drive `C:` filled during package/toolchain unpack | Free disk space (≥ 15 GB) or relocate `CARGO_HOME`/`RUSTUP_HOME` to drive `D:`. |
| `WebView2 loader not found` | WebView2 runtime missing | Modern Windows includes WebView2. If missing, install Evergreen WebView2 bootstrapper. |
| `EPERM: operation not permitted` on the target directory | File lock by anti-virus or running process | Add the target directory (e.g. `D:\cargo-target`) to Windows Defender exclusions. |
