use super::*;
use std::fs::{create_dir_all, remove_dir_all, write};

struct TestRepo {
    root: PathBuf,
}

impl Drop for TestRepo {
    fn drop(&mut self) {
        let _ = remove_dir_all(&self.root);
    }
}

impl TestRepo {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("icarus-review2-{}", Uuid::new_v4()));
        create_dir_all(&root).unwrap();
        let repo = Self { root };
        repo.git(&["init", "--quiet"]);
        repo.git(&["config", "user.email", "synthetic@example.invalid"]);
        repo.git(&["config", "user.name", "Synthetic Test"]);
        repo.git(&["config", "core.autocrlf", "false"]);
        repo
    }

    fn git(&self, args: &[&str]) -> String {
        let output = Command::new("git")
            .current_dir(&self.root)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {:?}: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap().trim().to_owned()
    }

    fn file(&self, path: &str, contents: &[u8]) {
        let target = self.root.join(path);
        create_dir_all(target.parent().unwrap()).unwrap();
        write(target, contents).unwrap();
    }

    fn commit_all(&self, message: &str) -> String {
        self.git(&["add", "--all"]);
        self.git(&["commit", "--quiet", "-m", message]);
        self.git(&["rev-parse", "HEAD"])
    }

    fn seeded(commits: usize) -> Self {
        let repo = Self::new();
        repo.file("theory.md", b"# Synthetic 0\n");
        repo.commit_all("root");
        for index in 1..commits {
            repo.file("theory.md", format!("# Synthetic {index}\n").as_bytes());
            repo.commit_all(&format!("synthetic {index}"));
        }
        repo
    }

    fn session(&self) -> Session {
        open_session_core(self.root.to_str().unwrap(), "synthetic-workspace", true).unwrap()
    }
}

fn capture_input(preparation: &Preparation, paths: &[&str]) -> CaptureInput {
    CaptureInput {
        session_id: preparation.descriptor.session_id.clone(),
        preparation_id: preparation.descriptor.preparation_id.clone(),
        request_id: Uuid::new_v4().to_string(),
        selected_paths: paths.iter().map(|value| (*value).to_owned()).collect(),
    }
}

#[test]
fn last_one_and_ten_are_pinned_before_file_selection() {
    let repo = TestRepo::seeded(12);
    repo.file("other.md", b"context\n");
    repo.commit_all("other only");
    let session = repo.session();
    let one = prepare_core(&session, 1).unwrap();
    let ten = prepare_core(&session, 10).unwrap();
    assert_eq!(one.descriptor.commits.len(), 1);
    assert_eq!(ten.descriptor.commits.len(), 10);
    assert_eq!(one.descriptor.head_commit_id, ten.descriptor.head_commit_id);
    assert_eq!(
        prepare_core(&session, 0).unwrap_err().code,
        "invalid-selection"
    );
    assert_eq!(
        prepare_core(&session, 11).unwrap_err().code,
        "invalid-selection"
    );
    let captured = capture_core(
        &session,
        &ten,
        &capture_input(&ten, &["other.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert_eq!(captured.manifest.commits.len(), 10);
}

#[test]
fn merge_counts_once_and_uses_first_parent() {
    let repo = TestRepo::seeded(2);
    let main = repo.git(&["branch", "--show-current"]);
    repo.git(&["checkout", "--quiet", "-b", "synthetic-side"]);
    repo.file("side.md", b"side\n");
    let side = repo.commit_all("side");
    repo.git(&["checkout", "--quiet", &main]);
    repo.file("main.md", b"main\n");
    let first_parent = repo.commit_all("main");
    repo.git(&[
        "merge",
        "--quiet",
        "--no-ff",
        "synthetic-side",
        "-m",
        "merge",
    ]);
    let merge = repo.git(&["rev-parse", "HEAD"]);
    let prepared = prepare_core(&repo.session(), 2).unwrap();
    assert_eq!(prepared.descriptor.commits[1].commit_id, merge);
    assert_eq!(prepared.descriptor.commits[1].first_parent_id, first_parent);
    assert!(prepared.descriptor.commits[1].parent_ids.contains(&side));
}

#[test]
fn edit_and_revert_retain_both_patches() {
    let repo = TestRepo::seeded(2);
    let original = fs::read(repo.root.join("theory.md")).unwrap();
    repo.file("theory.md", b"# Temporary synthetic edit\n");
    repo.commit_all("edit");
    repo.file("theory.md", &original);
    repo.commit_all("revert");
    let session = repo.session();
    let prepared = prepare_core(&session, 2).unwrap();
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &["theory.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert_eq!(captured.patches.len(), 2);
    assert_ne!(captured.patches[0].commit_id, captured.patches[1].commit_id);
}

#[test]
fn advancing_head_keeps_pinned_evidence() {
    let repo = TestRepo::seeded(3);
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let pinned = prepared.descriptor.head_commit_id.clone();
    repo.file("theory.md", b"# Newer unselected commit\n");
    repo.commit_all("advance");
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &["theory.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert!(captured.head_advanced);
    assert_eq!(captured.manifest.head_commit_id, pinned);
    assert!(!captured.files[0]
        .head_blob
        .as_ref()
        .unwrap()
        .content
        .contains("Newer"));
}

#[test]
fn dirty_and_untracked_are_warned_and_excluded() {
    let repo = TestRepo::seeded(3);
    repo.file("theory.md", b"dirty\n");
    repo.file("untracked.md", b"untracked\n");
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    assert!(prepared.descriptor.working_tree_warning.is_some());
    assert!(!prepared.head_entries.contains_key("untracked.md"));
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &["theory.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert_ne!(
        captured.files[0].head_blob.as_ref().unwrap().content,
        "dirty\n"
    );
}

#[test]
fn context_deletion_rename_and_empty_source_are_represented() {
    let repo = TestRepo::seeded(2);
    repo.file("context.md", b"unchanged\n");
    repo.file("delete.md", b"delete me\n");
    repo.file("old name.md", b"rename me\n");
    repo.commit_all("fixtures");
    repo.git(&["mv", "old name.md", "new name.md"]);
    repo.git(&["rm", "delete.md"]);
    repo.file("empty.md", b"");
    repo.commit_all("delete rename empty");
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(
            &prepared,
            &[
                "context.md",
                "delete.md",
                "old name.md",
                "new name.md",
                "empty.md",
            ],
        ),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert_eq!(captured.files.len(), 5);
    assert!(captured
        .files
        .iter()
        .find(|file| file.path == "delete.md")
        .unwrap()
        .head_blob
        .is_none());
    assert_eq!(
        captured
            .files
            .iter()
            .find(|file| file.path == "empty.md")
            .unwrap()
            .head_blob
            .as_ref()
            .unwrap()
            .content,
        ""
    );
    assert!(captured.patches.len() >= 4);
}

#[test]
fn no_repo_unborn_short_root_and_detached_are_explicit() {
    let outside = std::env::temp_dir().join(format!("icarus-review2-none-{}", Uuid::new_v4()));
    create_dir_all(&outside).unwrap();
    assert_eq!(
        open_session_core(outside.to_str().unwrap(), "workspace", true)
            .unwrap_err()
            .code,
        "not-a-repository"
    );
    remove_dir_all(outside).unwrap();

    let unborn = TestRepo::new();
    assert_eq!(
        prepare_core(&unborn.session(), 1).unwrap_err().code,
        "no-commits"
    );
    let repo = TestRepo::seeded(2);
    let session = repo.session();
    assert_eq!(
        prepare_core(&session, 3).unwrap_err().code,
        "insufficient-history"
    );
    assert_eq!(
        prepare_core(&session, 2).unwrap_err().code,
        "root-range-unsupported"
    );
    repo.git(&["checkout", "--detach", "--quiet"]);
    assert!(prepare_core(&repo.session(), 1)
        .unwrap()
        .descriptor
        .branch_name
        .is_none());
}

#[test]
fn nested_vault_scopes_cross_boundary_rename() {
    let repo = TestRepo::seeded(2);
    repo.file("vault/inside.md", b"inside\n");
    repo.file("outside.md", b"outside synthetic\n");
    repo.commit_all("nested fixtures");
    repo.git(&["mv", "outside.md", "vault/moved-in.md"]);
    repo.commit_all("cross boundary");
    let session = open_session_core(
        repo.root.join("vault").to_str().unwrap(),
        "nested-workspace",
        true,
    )
    .unwrap();
    let prepared = prepare_core(&session, 1).unwrap();
    assert!(prepared.head_entries.contains_key("inside.md"));
    assert!(!prepared.head_entries.contains_key("theory.md"));
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &["moved-in.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert!(captured.patches[0].content.contains("outside synthetic"));
    assert!(!captured.patches[0].content.contains("outside.md"));
}

#[test]
fn linked_worktree_is_supported() {
    let repo = TestRepo::seeded(3);
    let linked = std::env::temp_dir().join(format!("icarus-review2-worktree-{}", Uuid::new_v4()));
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "--detach",
        linked.to_str().unwrap(),
    ]);
    let session = open_session_core(linked.to_str().unwrap(), "linked-workspace", true).unwrap();
    assert!(matches!(
        session.descriptor.worktree_layout,
        WorktreeLayout::Linked
    ));
    assert_eq!(
        prepare_core(&session, 1).unwrap().descriptor.commits.len(),
        1
    );
    repo.git(&["worktree", "remove", "--force", linked.to_str().unwrap()]);
}

#[test]
fn literal_paths_binary_and_traversal_are_enforced() {
    let repo = TestRepo::seeded(2);
    let literal = "- [synthetic] ünicode.md";
    repo.file(literal, "math $x$ and [[link]]\r\n".as_bytes());
    repo.file("binary.md", b"ok\0not text");
    repo.file("invalid.md", &[0xff, 0xfe]);
    repo.commit_all("literal paths");
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &[literal]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert!(captured.files[0]
        .head_blob
        .as_ref()
        .unwrap()
        .content
        .contains("[[link]]\r\n"));
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["../secret.md"]),
            &AtomicBool::new(false),
        )
        .unwrap_err()
        .code,
        "invalid-selection"
    );
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["binary.md"]),
            &AtomicBool::new(false),
        )
        .unwrap_err()
        .code,
        "unsupported-file"
    );
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["invalid.md"]),
            &AtomicBool::new(false),
        )
        .unwrap_err()
        .code,
        "invalid-utf8"
    );
}

#[test]
fn cancellation_and_tampered_identifiers_fail_closed() {
    let repo = TestRepo::seeded(3);
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["theory.md"]),
            &AtomicBool::new(true),
        )
        .unwrap_err()
        .code,
        "cancelled"
    );
    let state = ReviewSourceState::default();
    assert!(lock_inner(&state)
        .unwrap()
        .sessions
        .get("tampered")
        .is_none());
    let canonical = fs::canonicalize(&repo.root).unwrap();
    let registry = Registry {
        schema_version: 1,
        workspaces: vec![RegistryWorkspace {
            root_path: repo.root.to_string_lossy().into_owned(),
            workspace_id: "synthetic-workspace".to_owned(),
        }],
    };
    assert!(registry_authorizes(
        &registry,
        &repo.root,
        &canonical,
        "synthetic-workspace"
    ));
    assert!(!registry_authorizes(
        &registry,
        &repo.root,
        &canonical,
        "foreign-workspace"
    ));
}

#[test]
fn external_diff_and_fsmonitor_helpers_do_not_execute() {
    let repo = TestRepo::seeded(2);
    let marker = repo.root.join("helper-ran");
    let helper = repo.root.join(if cfg!(windows) {
        "helper.cmd"
    } else {
        "helper.sh"
    });
    let script = if cfg!(windows) {
        format!("@echo off\r\necho ran>\"{}\"\r\n", marker.display())
    } else {
        format!("#!/bin/sh\nprintf ran > '{}'\n", marker.display())
    };
    write(&helper, script).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&helper, fs::Permissions::from_mode(0o755)).unwrap();
    }
    repo.file("theory.md", b"# helper defense\n");
    repo.file(".gitattributes", b"theory.md diff=synthetic-helper\n");
    repo.commit_all("helper defense");
    repo.git(&["config", "diff.external", helper.to_str().unwrap()]);
    repo.git(&[
        "config",
        "diff.synthetic-helper.textconv",
        helper.to_str().unwrap(),
    ]);
    repo.git(&["config", "core.fsmonitor", helper.to_str().unwrap()]);
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let _ = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &["theory.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert!(!marker.exists());
}

#[test]
fn shallow_boundary_missing_object_and_large_blob_fail_without_fallback() {
    let shallow_repo = TestRepo::seeded(3);
    let boundary = shallow_repo.git(&["rev-parse", "HEAD~1"]);
    write(
        shallow_repo.root.join(".git/shallow"),
        format!("{boundary}\n"),
    )
    .unwrap();
    assert_eq!(
        prepare_core(&shallow_repo.session(), 2).unwrap_err().code,
        "insufficient-history"
    );

    let missing_repo = TestRepo::seeded(3);
    let session = missing_repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let oid = prepared.head_entries["theory.md"].oid.clone();
    let loose = session
        .common_dir
        .join("objects")
        .join(&oid[..2])
        .join(&oid[2..]);
    assert!(loose.exists());
    fs::remove_file(loose).unwrap();
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["theory.md"]),
            &AtomicBool::new(false),
        )
        .unwrap_err()
        .code,
        "missing-object"
    );

    let large_repo = TestRepo::seeded(2);
    large_repo.file("large.md", &vec![b'x'; MAX_BLOB_BYTES + 1]);
    large_repo.commit_all("large synthetic file");
    let session = large_repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["large.md"]),
            &AtomicBool::new(false),
        )
        .unwrap_err()
        .code,
        "size-limit"
    );

    let total_repo = TestRepo::seeded(2);
    total_repo.file("context-a.md", &vec![b'a'; 460 * 1024]);
    total_repo.file("context-b.md", &vec![b'b'; 460 * 1024]);
    total_repo.commit_all("large contexts");
    total_repo.file("theory.md", b"# newest range\n");
    total_repo.commit_all("newest range");
    let session = total_repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    assert_eq!(
        capture_core(
            &session,
            &prepared,
            &capture_input(&prepared, &["context-a.md", "context-b.md"]),
            &AtomicBool::new(false),
        )
        .unwrap_err()
        .code,
        "size-limit"
    );
}

#[test]
fn symlink_and_submodule_tree_modes_are_never_read_as_markdown() {
    let repo = TestRepo::seeded(2);
    repo.file("link-target", b"target.md");
    let link_oid = repo.git(&["hash-object", "-w", "link-target"]);
    let commit_oid = repo.git(&["rev-parse", "HEAD"]);
    repo.git(&[
        "update-index",
        "--add",
        "--cacheinfo",
        "120000",
        &link_oid,
        "linked.md",
    ]);
    repo.git(&[
        "update-index",
        "--add",
        "--cacheinfo",
        "160000",
        &commit_oid,
        "module.md",
    ]);
    repo.git(&["commit", "--quiet", "-m", "special tree modes"]);
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let linked = eligible_tree_entry(&prepared.head_entries["linked.md"]);
    let module = eligible_tree_entry(&prepared.head_entries["module.md"]);
    assert!(matches!(linked.1, FileAvailability::UnsupportedSymlink));
    assert!(matches!(module.1, FileAvailability::UnsupportedSubmodule));
    assert!(!linked.0 && !module.0);
}

#[test]
fn context_inventory_is_searchable_pageable_and_bounded() {
    let repo = TestRepo::seeded(2);
    repo.file("context-a.md", b"a\n");
    repo.file("context-b.md", b"b\n");
    repo.commit_all("context fixtures");
    repo.file("theory.md", b"# newest\n");
    repo.commit_all("newest range");
    let session = repo.session();
    let prepared = prepare_core(&session, 1).unwrap();
    let first = list_files_core(
        &session,
        &prepared,
        &ListFilesInput {
            session_id: session.descriptor.session_id.clone(),
            preparation_id: prepared.descriptor.preparation_id.clone(),
            query: "context".to_owned(),
            cursor: None,
            limit: 1,
        },
    )
    .unwrap();
    assert_eq!(first.files.len(), 1);
    assert_eq!(first.total_matching, 2);
    assert_eq!(first.next_cursor.as_deref(), Some("1"));
}

#[test]
fn source_capture_smoke_prints_inspectable_summary() {
    let repo = TestRepo::seeded(3);
    repo.file("context.md", b"# Synthetic context\n");
    repo.commit_all("add context");
    let session = repo.session();
    let prepared = prepare_core(&session, 2).unwrap();
    let captured = capture_core(
        &session,
        &prepared,
        &capture_input(&prepared, &["theory.md", "context.md"]),
        &AtomicBool::new(false),
    )
    .unwrap();
    println!("SOURCE CAPTURE SMOKE — LOCAL SYNTHETIC REPOSITORY");
    println!("commits: {}", captured.manifest.commits.len());
    println!("base: {}", captured.manifest.base_commit_id);
    println!("head: {}", captured.manifest.head_commit_id);
    println!("selected paths: {}", captured.selected_paths.join(", "));
    println!("captured bytes: {}", captured.manifest.captured_byte_count);
    println!("completeness: {}", captured.completeness);
}
