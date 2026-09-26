# Desktop Shell

Status: **STABLE — KG11 live update, resync, capability, and controller gates pass.**

This package owns the minimal Tauri v2 process around the existing
`apps/web` Vite application. Rust registers the dialog/filesystem plugins and
dedicated, read-only Git review-source commands plus the fixed Windows
Scheduled Task ensure command. It exposes no general process API. Markdown
parsing, resolution, stable identity, diagnostics, graph projection, review
orchestration, and UI remain in TypeScript packages.

```text
package.json                 Tauri CLI scripts and pinned CLI version.
icon.svg                     Editable source for the generated desktop icons.
src-tauri/
  Cargo.toml                 Minimal pinned Rust dependencies.
  Cargo.lock                 Reproducible Rust dependency graph.
  tauri.conf.json            Existing-web build/dev wiring and window config.
  tauri.global-renderer-spike.conf.json KG13A-only release harness override.
  capabilities/main.json     Dialog, selected-root read/watch, and app-data scope.
  src/lib.rs                 Tauri/plugin initialization.
  src/compiler_tunnel.rs     Fixed Windows Scheduled Task ensure boundary and platform-neutral result tests.
  src/review_source.rs       Authorized, pinned, bounded read-only Git capture and disposable-repository tests.
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
| `serde`                     | 1.0.229 | MIT OR Apache-2.0 |
| `serde_json`                | 1.0.151 | MIT OR Apache-2.0 |
| `uuid`                      |  1.26.0 | MIT OR Apache-2.0 |

```bash
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:check` includes the native test suite, including disposable real-Git
capture cases; CI therefore validates behavior rather than only compiling the
commands.

KG13A additionally provides `pnpm desktop:global-renderer:build`. Tauri merges the
explicit diagnostic config at build time, changes the window/product label, builds
`tools/global-renderer-spike`, and packages that output instead of `apps/web`.
This command is only for release-WebView renderer evidence; it does not add a
Structure/Global switch or change the normal `desktop:build` path.

`desktop:dev` starts the existing web Vite server at `127.0.0.1:1420` and
opens it in a native window. `desktop:build` performs a release build without
an installer/bundle; signing, packaging, updater, and release automation are
outside KG11A. Ordinary `pnpm dev` remains browser-only.

On Windows, the existing `Icarus Argument Compiler Tunnel` Scheduled Task is
the primary/autostart lifecycle owner for the local Compiler tunnel. Opening
Arguments in the desktop app performs one best-effort, idempotent fallback:
it queries that fixed task and starts it only when it is not already running.
Graph Explorer does not install, configure, update, stop, or duplicate the
task or its external startup script, and closing Arguments or Graph Explorer
does not shut the tunnel down. Browser builds do not expose this capability;
non-Windows desktop builds return a clean unsupported-platform result.

The main window enables Tauri's `zoomHotkeysEnabled` input path because Wry
otherwise disables WebView2 precision-touchpad pinch before the graph can
receive its ctrl-modified wheel signal. The graph's non-passive wheel handler
still owns that gesture and prevents WebView page zoom while applying focal
canvas zoom. Keep this window setting aligned with the renderer gesture model.

## Security boundary

The Compiler tunnel command is a separate zero-input native boundary, not a
general process launcher. Its Scheduled Task name, PowerShell program, and
PowerShell arguments are fixed in Rust; renderer code cannot provide a task
name, executable, script path, or command string. Native stdout and stderr are
discarded, and fixed sanitized errors never expose process output.

The main window can open a native directory dialog. Tauri adds the selected
directory to filesystem scope for that process, after which the TypeScript
source provider can perform read-only recursive acquisition and watching. The
Rust filesystem plugin enables its pinned `watch` feature, and the main
capability adds only `fs:allow-watch` and `fs:allow-unwatch`; it does not grant
`$HOME/**`, a drive root, or another blanket vault scope. App-owned
registry/catalog state is restricted to the application-local data directory.
The capability names that grant those private reads, writes, and metadata
checks target `$APPLOCALDATA` explicitly. At startup the shell resolves that
directory through Tauri and adds both its logical path and effective canonical
path to the runtime filesystem scope. The second path is required when a
Windows app container virtualizes application-local files; both scopes remain
restricted to private application state, and command permissions remain
capability-gated. Keep these scopes aligned with `appLocalDataDir()` if the
storage root changes.

Live AI Review does not add a native command or network proxy. The web
application calls OpenAI through its provider-neutral REVIEW1 boundary using a
session-memory key entered by the user. The desktop shell never receives or
persists that credential.
See [`../../docs/REVIEW4_OPENAI_AGENTS_PROVIDER.md`](../../docs/REVIEW4_OPENAI_AGENTS_PROVIDER.md).

Dialog-added scope is not durable. Restarting requires the user to select the
vault again; an exact normalized private registry match then recovers its stable
workspace identity. The web application controller applies coalesced provider
plans transactionally to KG10, keeps the watcher active through recovery scans,
and publishes a replacement graph/report only after stable catalog persistence.
Source files and assets remain read-only; only app-local identity state changes.
The Git capture module additionally requires the exact selected-root registry
association before opening an opaque session. Associated main/linked-worktree
metadata is accepted only in validated standard layouts; alternate object
stores are refused. Git is launched internally with no shell, no inherited
Git configuration environment, no helper execution, no lazy network fetch,
finite output/time limits, and repository writes disabled. Capabilities still
contain no shell or process permission.
