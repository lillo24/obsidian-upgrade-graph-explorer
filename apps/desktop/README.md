# Desktop Shell

Status: **STABLE — KG11A compile, capability, and one-shot vault-open gates pass.**

This package owns the minimal Tauri v2 process around the existing
`apps/web` Vite application. Rust registers only the dialog and filesystem
plugins. Markdown parsing, resolution, stable identity, diagnostics, graph
projection, and UI remain in the TypeScript workspace packages.

```text
package.json                 Tauri CLI scripts and pinned CLI version.
icon.svg                     Editable source for the generated desktop icons.
src-tauri/
  Cargo.toml                 Minimal pinned Rust dependencies.
  Cargo.lock                 Reproducible Rust dependency graph.
  tauri.conf.json            Existing-web build/dev wiring and window config.
  capabilities/main.json     Dialog, selected-root reads, and app-data scope.
  src/lib.rs                 Tauri/plugin initialization.
  src/main.rs                Desktop executable entry point.
  icons/                     Tauri-generated desktop icon formats.
```

## Development

On Windows, install the Microsoft C++ Build Tools, WebView2, and the stable
Rust MSVC toolchain required by Tauri. Linux CI installs the current Tauri
WebKitGTK/system prerequisites separately from the ordinary repository job.

KG11A pins the versions verified against the Tauri v2 documentation and the
npm/crates registries:

| Dependency                  | Version | License           |
| --------------------------- | ------: | ----------------- |
| `@tauri-apps/cli`           |  2.11.4 | Apache-2.0 OR MIT |
| `@tauri-apps/api`           |  2.11.1 | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-dialog` |   2.7.2 | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-fs`     |   2.5.1 | MIT OR Apache-2.0 |
| `tauri`                     |  2.11.5 | MIT OR Apache-2.0 |
| `tauri-build`               |   2.6.3 | MIT OR Apache-2.0 |
| `tauri-plugin-dialog`       |   2.7.2 | MIT OR Apache-2.0 |
| `tauri-plugin-fs`           |   2.5.1 | MIT OR Apache-2.0 |

```bash
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:dev` starts the existing web Vite server at `127.0.0.1:1420` and
opens it in a native window. `desktop:build` performs a release build without
an installer/bundle; signing, packaging, updater, and release automation are
outside KG11A. Ordinary `pnpm dev` remains browser-only.

## Security boundary

The main window can open a native directory dialog. Tauri adds the selected
directory to filesystem scope for that process, after which the TypeScript
source provider performs one read-only recursive acquisition. The static
capability does not grant `$HOME/**`, a drive root, or another blanket vault
scope. App-owned registry/catalog state is restricted to the application-local
data directory.

Dialog-added scope is not durable. Restarting requires the user to select the
vault again; an exact normalized private registry match then recovers its stable
workspace identity. KG11A does not watch files or silently reopen a prior root.
