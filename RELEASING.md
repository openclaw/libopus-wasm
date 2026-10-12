# Releasing

`libopus-wasm` ships an npm tarball and a GitHub Release through
`release-npm-package.yml`. The build uses the same pinned Emscripten and pnpm
versions as CI. Two clean Linux architectures install the frozen tarball with
lifecycle scripts disabled and check real encode/decode through both public
entrypoints. The publisher consumes only verified tarball bytes, then checks npm
integrity, signatures, and provenance before creating the GitHub Release with
changelog notes, package plan, inventory, tarball, and `SHA256SUMS`.

The `Release` workflow calls the shared OpenClaw archetype at `@v1`. It
requires a protected `main`, matching version metadata, a dated changelog section,
and successful independent **push** CI on the exact release commit. It verifies
SSH-signed annotated tags against `.github/release-allowed-signers` and rejects
moved tags or an existing GitHub Release.

Prepare the version and dated `## X.Y.Z - YYYY-MM-DD` changelog section in a PR,
retain `## Unreleased`, and merge only after CI and review. After explicit release
authorization, create and push an SSH-signed annotated `vX.Y.Z` tag at that merged
commit using an allowed signing key. Tag pushes publish through Actions; manual
GitHub Release creation is retired. A live dispatch cannot create a missing signed
tag: create the signed tag first.

For a no-publish rehearsal, dispatch `release.yml` on current `main` with a version
that already has a dated changelog section and `dry_run=true` (the default):

```sh
gh workflow run release.yml --ref main -f version=0.4.1 -f dry_run=true
```

The rehearsal exercises current protected main, even when the version already has
an older tag. It creates no tag, release, or registry publication. Inspect every
job and the retained verification artifacts before release. Real releases never
move a tag or overwrite an existing version.

The existing `libopus-wasm` npm package must trust the caller `release.yml` in
`openclaw/libopus-wasm`. Publication uses GitHub OIDC; no npm token secret is
required or accepted. Stable versions use `latest`, prereleases use `next`.
Local `npm publish` is retired. Local `pnpm build`, `pnpm pack`, and the packaged
`scripts/release-smoke.mjs` remain available for read-only verification.

After publication, verify the Actions result, GitHub Release notes and checksum
assets, and registry metadata:

```sh
npm view libopus-wasm@X.Y.Z version dist-tags dist time --json
```
