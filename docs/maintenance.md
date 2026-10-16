# Maintenance and release baseline

Reviewed on October 16, 2026, against `main` at `448d781`. The previous
baseline PR (#54) is merged, but the coordinated `0.2.0` release remains pending.
This maintenance pass updates the workspace toolchain, repairs React dependency
alignment, and makes packaging and scaffold checks prerequisites for publishing.

## Pull request triage

| Existing PR                                                                          | Disposition after this maintenance PR merges                                                                                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#55](https://github.com/GhostScientist/nearstack/pull/55), TypeScript ESLint        | Superseded by the compatible updates here.                                                                                                                           |
| [#56](https://github.com/GhostScientist/nearstack/pull/56), Vitest                   | Superseded; Vitest and its coverage provider stay on the same version.                                                                                               |
| [#59](https://github.com/GhostScientist/nearstack/pull/59), development dependencies | Superseded. Its CI failure came from React 19.3.0 paired with React DOM 19.2.8. React DOM is now an explicit development dependency, and Dependabot groups the pair. |
| [#60](https://github.com/GhostScientist/nearstack/pull/60), GitHub Actions           | Its four SHA-pinned action updates are included here.                                                                                                                |
| [#58](https://github.com/GhostScientist/nearstack/pull/58), Node 26 types            | Defer until the minimum runtime changes. Keep Node 22 types so type checking cannot silently admit Node 26-only APIs.                                                |

The PRs remain open for review; do not merge superseded dependency changes back
over the newer versions in this branch.

## Branch triage

Four remote feature branches are fully contained in `main` and are candidates
for deletion after confirming that nobody is still using them:

- `claude/react-19-upgrade-Ycgkn`
- `codex/add-sveltekit,-angular,-vue-to-cli`
- `fix/model-download-state-machine`
- `ghostscientist-narrow-dependabot-dev-group`

Preserve `claude/webrtc-p2p-nearstack-g2zFx`: it has one unmerged commit,
`60ce566`, containing about 2,200 lines of CRDT, signaling, peer, and sync work.
It is 71 commits behind this baseline and has no associated PR. Rebase and review
it as a separate feature; the RTC package on `main` is still a stub.

The local `codex/implement-nearstack-mvp-roadmap-phases` branch also has an
unmerged commit, `00edf5f`, excluding tests from core compilation. The current
configuration already excludes `__tests__` directories; that commit also excludes
all `*.test.ts` files. Reconcile that additional pattern before deleting the
branch. Other old local
branches are ancestors of `main`; the local `main` itself is 59 commits behind
`origin/main`. Two older branches are checked out in separate worktrees, so
branch cleanup must account for those checkouts. This pass does not delete
branches or alter those worktrees.

## Issue reconciliation

The open tracker contains several issues whose implementations landed in #54
or earlier. Review the remaining acceptance criteria before closing them:

| Issues        | Current evidence and remaining work                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #13, #14      | AI tests cover retry after failure, deduplicating downloads of the same model, and rejecting competing downloads.                                                                   |
| #22, #23, #25 | CLI validates resolved destinations, substitutes project names literally, and catches errors at its async entrypoint. Scaffold tests cover invalid targets and cancelled overwrite. |
| #24           | Lint passes and the public generic types have been tightened.                                                                                                                       |
| #35, #38      | Core has shared notifications, ordered migrations with rollback, persistence requests, and documented quota errors. Migration and notification tests pass.                          |
| #39           | Svelte exposes async state, write failures, reactive queries, and teardown tests. Check the issue's explicit storage-read rejection scenarios before closing.                       |
| #40           | Core coverage runs in CI. Excluding `schema.test.ts` lowers branch coverage to 58.06%, below the 60% floor, and fails as intended.                                                  |
| #32           | All four generated apps build against locally packed packages. The requested deliberate API-break negative test still needs explicit evidence before closure.                       |
| #34           | Version alignment, package checks, and publishing automation exist. Actual publication, registry credential setup, and a dated released changelog entry remain outstanding.         |
| #1            | The project structure exists; the issue has no acceptance criteria. Confirm its intent before closing.                                                                              |

## Validation and recurring maintenance

Use Node 22.14 or newer and the pnpm version recorded in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm exec prettier --check 'packages/*/src/**/*.{ts,tsx,json}'
pnpm --filter @nearstack-dev/core test:coverage
pnpm --filter @nearstack-dev/ai test:coverage
pnpm release:check
pnpm release:dry-run
pnpm test:scaffolds
pnpm audit
```

CI runs builds, tests, and coverage on Node 22 and 24; checks all four scaffold
builds; and validates packed entrypoints on Node 22. A weekly Monday run at
10:40 UTC repeats these checks and audits workspace dependencies, including when
no code changes. Dependabot checks both the workspace and the four independent
template manifests weekly.

The workspace audit went from 11 advisories (6 high, 3 moderate, 2 low) to zero.
The targeted `tsup@8>esbuild` override supplies patched esbuild 0.28.2. Remove
it when a compatible tsup release supplies a patched version itself; tsup 9
requires a newer minimum Node version than this project currently declares.

The workspace audit does **not** cover independently installed template
dependencies. Template framework modernization remains a separate priority:
the templates still use Vite 5, Svelte 4, and Angular 18. Their build checks
establish compilation compatibility, not browser interaction, WebGPU inference,
or a clean security audit of those generated dependency trees.

Main's active rules prevent deletion and force pushes, but do not require PR
reviews or passing status checks. Configure required checks for both Node builds,
lint, and all four scaffold jobs before relying on CI as a merge gate. Repository
rules were inspected but not changed in this PR.

## Publishing the pending release

1. Merge the maintenance PR only after its CI checks pass. Review the remaining
   template and release issues before choosing a publication date.
2. Confirm all seven package versions and template ranges match the intended
   release using `pnpm release:check`. Run `pnpm release:dry-run` and
   `pnpm test:scaffolds`; these commands do not publish.
3. Confirm npm scope access and a scoped `NPM_TOKEN` repository secret. Check
   the registry for existing versions before publishing; the dry run does not
   verify account permissions or version availability.
4. Create the matching version tag on the reviewed commit, or manually dispatch
   **Release** on `main`. Tag runs must match the root version exactly; manual
   branch runs are restricted to `main`.
5. The release workflow runs the full CI workflow first, then rebuilds the same
   commit with the frozen lockfile and publishes with provenance. It does not
   promote the dry-run archives themselves.
6. Verify the registry versions and install a fresh scaffold from the published
   CLI. Only then mark `0.2.0` as released with its actual date and reconcile #34.

If publication stops partway through, inspect which versions reached npm and
which packages failed before retrying the same reviewed tag. Never overwrite or
reuse a published version for changed code. A correction to shipped code needs
a new coordinated version, matching template ranges, and a new release tag.
