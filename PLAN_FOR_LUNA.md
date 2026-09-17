# Nearstack baseline: one implementation PR

## Objective

Deliver one PR against current `main` that resolves the open correctness and
maintenance backlog, incorporates the compatible dependency updates, and makes
Nearstack buildable, testable, and ready for a repeatable release. Include schema
migrations and storage durability in this PR; they are not a later follow-up.

This document is the implementation handoff. Creating it does not implement,
merge, publish, or close anything. Use ordered commits inside the single PR so
reviewers can follow the changes and individual changes remain recoverable.

Repository: <https://github.com/GhostScientist/nearstack>

Snapshot: September 16, 2026. Remote `main` was
`6eb9f2c1b963e1386c3dfbd2917c1f57d992a439`. Refresh GitHub state before starting;
issue descriptions and dependency versions are historical evidence, not an
instruction to overwrite newer work.

## Starting point

- The working directory used to write this plan is on the older
  `fix/model-download-state-machine` branch. Do not implement against that branch.
  Start a fresh branch/worktree from current remote `main`, bringing this document
  along and preserving unrelated local work.
- Read applicable `AGENTS.md` files and the current repository guidance, including
  `CLAUDE.md`. Keep that guidance accurate when scripts and APIs change.
- PRs [#16](https://github.com/GhostScientist/nearstack/pull/16),
  [#36](https://github.com/GhostScientist/nearstack/pull/36), and
  [#37](https://github.com/GhostScientist/nearstack/pull/37) already merged. Preserve
  their download-recovery, scaffold-build, and storage-correctness fixes.
- Two existing local worktrees have branches named
  `ghostscientist-template-smoke-test-script` and
  `ghostscientist-upgrade-typescript-7`. At inspection both were clean and at
  existing mainline commits. Recheck before reusing any work; branch names alone
  are not evidence of completed implementation.
- All nine open PRs are Dependabot updates. All currently have failing CI and no
  submitted reviews. Eight fail Prettier on the same three files:
  `packages/ai/src/errors.ts`, `packages/ai/src/ui/helpers.ts`, and
  `packages/core/src/storage.ts`. ESLint's PR fails before formatting runs.

## Scope and issue disposition

Every row must have implementation or explicit verification evidence in the PR.
Do not treat a plan, an unchecked acceptance criterion, or an existing branch as
completion.

| Issue | Required outcome in this PR |
| --- | --- |
| [#1](https://github.com/GhostScientist/nearstack/issues/1) Project structure | Verify the existing workspace satisfies the ticket; document closure evidence. No artificial restructuring. |
| [#13](https://github.com/GhostScientist/nearstack/issues/13) Download retry | Verify #16's fix remains effective in all four active templates and the AI API. |
| [#14](https://github.com/GhostScientist/nearstack/issues/14) Concurrent downloads | Verify single-flight behavior, error recovery, cancellation, and template re-entry guards. |
| [#22](https://github.com/GhostScientist/nearstack/issues/22) CLI target safety | Prevent destructive scaffold targets outside the intended project directory; display resolved paths. |
| [#23](https://github.com/GhostScientist/nearstack/issues/23) Substitution | Replace tokens literally without regex/replacement-string interpretation. |
| [#24](https://github.com/GhostScientist/nearstack/issues/24) Type/lint debt | Remove avoidable explicit `any` from owned APIs and hooks, preserving useful inference. |
| [#25](https://github.com/GhostScientist/nearstack/issues/25) CLI promises | Catch CLI failures, print a useful error, and exit unsuccessfully without an unhandled rejection. |
| [#32](https://github.com/GhostScientist/nearstack/issues/32) Scaffold CI | Install and build every active scaffold against packages built from this PR. |
| [#34](https://github.com/GhostScientist/nearstack/issues/34) Releases | Coherent versions, template/peer range checks, CI publishing with provenance, documented dry run. |
| [#35](https://github.com/GhostScientist/nearstack/issues/35) Migrations/durability | Atomic ordered schema migrations, observable persistence requests, distinguishable quota errors. |
| [#38](https://github.com/GhostScientist/nearstack/issues/38) Shared subscriptions | Same database/model definitions share notifications without leaks or ambiguous options. |
| [#39](https://github.com/GhostScientist/nearstack/issues/39) Svelte state | Observable read/write errors and loading state; genuinely reactive queries; real tests. |
| [#40](https://github.com/GhostScientist/nearstack/issues/40) Core coverage | Measured, meaningful coverage floors enforced by CI, including a verified negative case. |

RAG, RTC, indexed queries, encryption, file storage, and full Vue/Angular binding
libraries remain outside this baseline. Keep their experimental status explicit.
Do not add placeholder tests to make unimplemented packages appear complete.

## Baseline decisions

1. Use a coordinated breaking pre-1.0 release, provisionally `0.2.0`, for all seven
   published packages. Verify that version is available before finalizing it.
   Include the private root version for consistency. Document storage defaults,
   Svelte API changes, type tightening, and any narrowed runtime/peer support.
2. Keep Node 22 as the minimum supported major and primary development/CI runtime;
   select and document a minimum minor compatible with the chosen toolchain.
   Verify dependency engine requirements from their official metadata/docs.
   Add a supported newer LTS CI lane. Align `@types/node` to the minimum runtime's
   major instead of adopting Node 26 types just to clear a bot PR.
3. Adopt TypeScript 6, ESLint 10 with flat config, and Svelte 5 with the necessary
   source/config/test changes. Resolve actual package compatibility before locking
   versions; do not blindly use newer majors that appear during implementation.
4. Retain the four offered frameworks: React, Vue, Angular, and SvelteKit. Remove
   the unreachable legacy `templates/svelte` directory and obsolete references;
   retain and repair the separate `@nearstack-dev/svelte` bindings package.
5. Keep published dependency ranges in generated apps. Generate those ranges
   from the coordinated release version and validate them. Internal workspace
   dependencies may remain `workspace:*`, rewritten when packing/publishing.
6. Use small repository-owned release scripts and an explicit CI release trigger.
   Add a release framework only if it demonstrably simplifies the requirements.
   Merging the baseline PR must not automatically publish packages.

## 1. Restore the toolchain and integrate dependency updates

First reproduce the current baseline with a frozen install, build, tests, lint,
and formatting check. Record failures before changing code. Format the three
known files using the selected formatter and keep mechanical changes in their
own commit. Do not disable checks or ignore those files.

Use these dispositions for the existing dependency PRs. Incorporate their intent
into the single baseline branch; do not merge them independently as prerequisites.

| PR | Integration work |
| --- | --- |
| [#44](https://github.com/GhostScientist/nearstack/pull/44) TypeScript 6.0.3 | Update workspace compiler versions together. Fix deprecated `baseUrl` configuration and declaration generation; avoid leaving `ignoreDeprecations` as the solution. Build all packages and templates. The branch name mentions TypeScript 7, but the inspected PR targets 6.0.3. |
| [#45](https://github.com/GhostScientist/nearstack/pull/45) jsdom 30.0.1 | Update test environments together; verify engine requirements and all DOM-based tests. |
| [#46](https://github.com/GhostScientist/nearstack/pull/46) Svelte 5.57.0 | Update the bindings development dependency and peer contract together. Test Svelte 5 behavior and the SvelteKit scaffold. Retain Svelte 4 peer support only if separately verified. |
| [#48](https://github.com/GhostScientist/nearstack/pull/48) fake-indexeddb 6.2.5 | Align core/AI test dependencies and run storage, concurrency, and migration regressions. |
| [#49](https://github.com/GhostScientist/nearstack/pull/49) typescript-eslint | Upgrade parser/plugin together to versions supporting the chosen ESLint and compiler. |
| [#50](https://github.com/GhostScientist/nearstack/pull/50) Actions | Incorporate action updates while preserving full SHA pins, least privileges, and disabled checkout credential persistence. |
| [#51](https://github.com/GhostScientist/nearstack/pull/51) React/WebLLM | Match React and React DOM exactly; the inspected PR has 19.3.0 vs. 19.2.8 and fails three React suites. Declare the DOM test dependency explicitly. Update related types and verify WebLLM integration without making its optional peer mandatory. |
| [#52](https://github.com/GhostScientist/nearstack/pull/52) Node 26 types | Supersede with runtime-aligned Node 22 types and a documented compatibility policy. This is an intentional replacement, not a claimed Node 26 upgrade. |
| [#53](https://github.com/GhostScientist/nearstack/pull/53) ESLint 10.10.0 | Replace `.eslintrc.json` with flat config; preserve effective rule coverage, correct TS/TSX matching, and build-output exclusions. |

Update Dependabot to group React/React DOM and their types, keep
typescript-eslint and Vitest matched, and prevent unsupported Node-type majors
from repeatedly reopening the same decision. Preserve separate major upgrades.
Regenerate the pnpm lockfile once dependencies are coherent; investigate and
remove the AI package's nested npm lockfile if it has no supported independent
workflow. Preserve an explicit, reproducible package-manager version.

Address #24 while touching API types: use generics, constrained record types,
and `unknown` with narrowing. Inventory current warnings rather than assuming the
issue's old count remains accurate. Add consumer type fixtures for inference and
invalid inputs. Any unavoidable third-party `any` must be locally explained;
blanket suppression or a sea of casts does not resolve this issue.

## 2. Make scaffolding safe and predictable

Files: `packages/cli/src/index.ts`, `src/cli.ts`, and CLI tests.

- Define supported targets as nonempty relative child paths under the caller's
  working directory. Reject absolute paths, the working directory itself, root,
  parent traversal, and paths whose real destination escapes through symlinks.
  Validate the nearest existing ancestor for targets not yet created.
- Resolve and validate before prompting or deleting. Display the absolute target
  in overwrite prompts. Cancellation must leave existing contents untouched.
  Never follow symlinks when clearing a target; test an outside sentinel file.
- Derive a valid package name separately from the destination path, so a nested
  target does not become an invalid `package.json` name. Document the contract.
- Replace tokens with literal substitution; correctly encode output for each
  target format. Test dollar replacement sequences and malformed names, whether
  supported literally or rejected explicitly.
- Await the scaffolder at the CLI boundary. Catch failures, print a concise
  actionable message, and return a nonzero exit code. Prefer library errors over
  internal `process.exit()` calls that prevent callers from handling failure.
- Verify valid creation, overwrite/cancel, missing template, filesystem failure,
  and both CLI aliases. Test destructive cases only inside temporary fixtures.

## 3. Complete the core storage contract

Implement #38 and #35 as adjacent commits because both touch model registration
and connection management. Preserve #37's bounded blocked-upgrade behavior,
recovery after abandoned opens, atomic updates, and explicit storage modes.

### Shared model notifications (#38)

- Maintain one registered model/notification channel per effective database and
  model name. Resolve global/default options before checking compatibility.
- Repeated compatible definitions reuse that registration. Conflicting storage
  modes or schema definitions throw a documented configuration error rather than
  silently taking the first value. Explicitly distinguish omitted options from
  conflicting options; migrations themselves must not create duplicate models.
- Every supported write path notifies subscribers only after a committed write.
  Failed/rolled-back writes must not announce successful changes.
- Unsubscribing one listener must preserve others. Distinct databases remain
  isolated. Define registry cleanup/reset behavior so repeated definitions do
  not grow listeners or retain obsolete connections indefinitely.
- Regression tests: cross-instance writes/notifications, direct store writes,
  unsubscribe, database isolation, option conflicts, and repeated registration.

### Schema migration contract (#35)

- Separate per-model schema versions from IndexedDB's structural database version.
  Store schema metadata persistently. Treat existing unversioned records as the
  documented initial schema version, provisionally version 1.
- Define a typed `schemaVersion` and explicit ordered migration API. Prefer
  synchronous record transformations so migration work stays inside an active
  IndexedDB transaction. Disallow network/async migration callbacks explicitly.
- Gate reads, writes, and `ready()` until required migrations finish. Apply all
  steps for a device skipping releases, including version 1 to version 3.
- Atomically commit migrated records and schema metadata in one transaction per
  model migration batch. An exception aborts the whole batch and preserves the
  previous schema/data; reject with an actionable migration error.
- Reject missing migration steps and opening data newer than the application
  understands. Specify the behavior for empty stores and memory/auto modes.
- Preserve record identities, unrelated models, and database isolation. Coordinate
  concurrent initializers and cross-tab upgrades through the existing connection
  manager; do not introduce indefinite waits or silently migrate twice.
- Test real legacy database fixtures, add-default and rename/transform migrations,
  multi-step upgrades, rollback, reopen/retry, newer-schema rejection, concurrent
  initialization, and preservation of unrelated stores.
- Document the exact API and an executable worked example in `docs/data-layer.md`.

### Durability and quota (#35)

- Provide a documented storage-durability operation that requests persistence
  when the platform supports it and reports granted, denied, or unsupported.
  Make the request timing explicit so apps can invoke it in an appropriate user
  interaction; unit tests must not depend on permission dialogs.
- Distinguish an IndexedDB backend from browser-granted protection against
  eviction. Audit `StorageStatus.persistent` wording; do not promise that an
  IndexedDB write alone makes data immune to eviction.
- Normalize `QuotaExceededError` from writes and transaction aborts into a
  distinguishable documented storage error, retaining the cause.
- Tests cover granted/denied/unsupported permission states, quota failures, and
  Worker/SSR environments. Denied persistence must not silently erase data,
  switch to memory, or imply that data is protected.

## 4. Repair Svelte bindings and verify AI recovery

For #39, expose typed observable `{ data, loading, error }` state for both binding
APIs. A clean breaking API is acceptable in the coordinated release; document
before/after usage rather than hiding errors behind the old `Writable<T>` shape.

- Reads, writes, and updates must surface errors as state. If a write also returns
  a rejecting promise, document that contract and ensure normal Svelte event
  usage does not create unhandled rejections.
- Persist writes before reporting success, or implement and test explicit
  optimistic rollback. Do not inherit a writable `update()` that bypasses storage.
- `liveQuery` accepts model dependencies, subscribes to changes, and re-runs.
  Record stores also refresh when their model changes.
- Manage subscriptions with the Svelte store lifecycle. Ignore stale asynchronous
  results and unsubscribe correctly so old queries cannot overwrite newer state.
- Add a real Vitest suite covering read/write rejection, recovery, loading,
  notifications, out-of-order queries, teardown, and core `StorageError` behavior.
  Exclude test files from production compilation and packed artifacts.

For #13/#14, inspect the current templates; paths in the original issues may no
longer exist. Preserve and exercise retry controls and in-flight guards across
React, Vue, Angular, and SvelteKit. Use a controllable fake AI provider for
failure-then-success, rapid selection, same-model deduplication, conflicting
downloads, cancellation, and retry. Retain the core/hook regression coverage.
Record browser smoke evidence for the template behavior; do not require a real
multi-gigabyte model download in routine CI. Fix any regressions uncovered here.

## 5. Make CI validate the complete product

### Scaffold smoke matrix (#32)

- Implement a reusable script that discovers frameworks from `FRAMEWORK_CHOICES`,
  invokes the built scaffolder, installs each generated app, and builds it in an
  isolated directory. Support noninteractive framework selection if necessary.
- Build and pack this PR's packages, then install those tarballs using temporary
  overrides. Include transitive internal dependencies and optional peers used by
  each template; do not accidentally test npm's old Nearstack packages.
- Verify installed package versions/contents match the packed artifacts. Smoke
  work must not mutate checked-in manifests or depend on unpublished versions
  being available from npm.
- Generate CI's matrix from the framework list. A new offered framework must be
  tested automatically or cause a visible failure, never silently be skipped.
- Run on PRs and pushes to `main`. Cache downloads using relevant lockfile and
  template inputs; set reasonable timeouts, including Angular's slower build.
- Negative proof: temporarily break a consumed exported core/AI type and show the
  scaffold check fails. Restore it and record both outcomes.

### Coverage and routine gates (#40)

- Measure final core coverage and enforce meaningful per-metric thresholds at or
  below measured coverage, with rationale beside the configuration. Include new
  migration/storage code, not just the easiest files.
- Run core coverage in CI. Also run the existing AI 80% coverage check; plain
  `pnpm test` does not enforce its coverage thresholds.
- Negative proof: remove a meaningful core test, show a coverage gate fails,
  restore it, and rerun. Choose a floor that protects significant behavior.
- Keep explicit build, unit tests, type fixtures, lint, format, package validation,
  and scaffold jobs. Preserve pinned actions and least privileges.
- Verify advertised runtime/peer support with appropriate matrix or consumer
  fixtures. Narrow unsupported claims explicitly instead of leaving untested
  compatibility ranges. Exercise React without the optional AI/WebLLM peers.

## 6. Prepare a coherent release (#34)

- Introduce one source of truth for the release version. Update all workspace
  packages, internal peer ranges, active template ranges, and the lockfile.
- Check every shipped template's Nearstack ranges against that version and flag
  stale minimums when the template relies on new APIs. A range like `^0.1.0`
  already permits `0.1.2`; do not confuse a permissive range with an exact pin.
  The new breaking `0.2.x` APIs must not claim compatibility with `0.1.x`.
- Pack every published package from a clean build. Inspect exports, declarations,
  template assets, rewritten workspace dependencies, and dependency ordering.
  Test imports from installed tarballs, including promised React ESM/CJS entry
  points. Exclude tests, coverage, caches, and source-only development artifacts.
- Keep RAG/RTC versions coherent but label them experimental; do not imply their
  features are implemented merely because their packages publish successfully.
- Add a release workflow triggered explicitly by a release tag or manual dispatch.
  Verify commit/version/tag agreement and successful gates before publishing.
  Include concurrency protection and safe retry behavior for partial publication;
  never try to overwrite an existing npm version or publish different bytes under
  the same version.
- Publish with npm provenance and narrowly scoped permissions/credentials. Prefer
  npm trusted publishing if repository/package configuration permits it; otherwise
  document required scoped repository secrets. Keep credentials out of files/logs.
- Implement a credential-free dry run through version/range validation, clean
  build, packing, consumer/scaffold installation, and publish preflight. Production
  publishes the validated artifacts, not a different unverified rebuild.
- Replace the documented developer-machine publishing path with the CI process.
  Document rollback/recovery, including how to resume a partially published set.
- Update README, changelogs, core docs, CLI docs, framework examples, and
  `CLAUDE.md`. Explain migration/storage/Svelte breaking changes and runtime policy.
  README status must reflect implemented and verified capabilities.

Do not invent a release date or claim npm publication from a dry run. Add a real
released-version changelog section only from verified tags/registry evidence, or
when the coordinated release actually occurs. Before publication, label the new
version as pending/unreleased. If #34's real-publication/changelog acceptance
remains pending at PR merge, leave that issue open and record the exact remaining
release action; do not use an automatic closing keyword for incomplete work.

## Commit sequence within the single PR

1. Shared formatting baseline and reproducible runtime/toolchain policy.
2. Dependency integrations, TypeScript/ESLint migrations, and Dependabot grouping.
3. CLI safety, literal substitution, and error handling.
4. Shared model registration/notifications and associated type cleanup.
5. Schema migrations, persistence reporting, and quota handling.
6. Svelte state/reactivity and AI/template recovery verification or fixes.
7. Scaffold smoke matrix, coverage gates, and consumer/package checks.
8. Coordinated versioning, release automation, and documentation.

Keep the PR description centered on the resulting baseline. Include the issue
mapping, intentional compatibility changes, dependency PR dispositions, and
validation evidence. Explain coupled changes instead of presenting an unexplained
dependency lockfile rewrite.

## Completion gates

The implementation PR is ready only when all applicable boxes are checked with
evidence from its final code. Implement the proposed scripts below and document
their exact names; they are not all present today.

- [ ] Clean checkout: frozen dependency install succeeds on the supported runtimes.
- [ ] `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm format:check` pass.
- [ ] Consumer type fixtures and advertised package entry points pass.
- [ ] `pnpm --filter @nearstack-dev/core test:coverage` passes with justified floors.
- [ ] `pnpm --filter @nearstack-dev/ai test:coverage` preserves the 80% floors.
- [ ] `pnpm test:scaffolds` installs/builds all four frameworks from this PR's packs.
- [ ] CLI destructive-target tests preserve external sentinel files and show clean errors.
- [ ] Storage migrations pass legacy, multi-version, rollback, and concurrency cases.
- [ ] Svelte reads/writes and AI retry/concurrency have behavior-level evidence.
- [ ] Temporary negative checks for scaffold API drift and core coverage fail as
      intended, are fully reverted, and final checks are green.
- [ ] `pnpm release:check` and `pnpm release:dry-run` validate coherent artifacts,
      versions, peer/template ranges, and a no-publish release path.
- [ ] No undocumented compatibility regressions, suppressed gates, stray test
      artifacts, or accidental changes from other branches/worktrees remain.
- [ ] Each issue and dependency PR has an explicit final disposition; limitations
      and any external npm configuration are stated accurately.

## GitHub and release handoff

Creating the single implementation PR is separate from merging it or publishing
to npm. This planning request does not itself authorize closing bot PRs, posting
comments, tagging a release, or publishing packages.

After the baseline merges, close superseded Dependabot PRs with a reference to it
when that GitHub cleanup is authorized. #52 is superseded by the documented
runtime policy; the others should be covered by integrated upgrades. Close #1,
#13, and #14 only after their completion is verified. Use closing references for
the remaining issues only when their actual acceptance criteria are met.

The resulting handoff should make three states unambiguous: implemented and
validated in the PR, merged into `main`, and published for users. A green baseline
PR must be release-ready; external account setup or actual publication must never
be represented as already done.
