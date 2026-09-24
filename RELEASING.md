# Releasing

Releases are published manually; pushing a tag does not publish to npm. Use an
npm account with publish access to `libopus-wasm` and a GitHub account with write
access to this repository.

1. Update `package.json` to the release version. Move the `Unreleased` entries
   into `## X.Y.Z - YYYY-MM-DD`, with a one-line **Highlights:** paragraph. Keep
   an empty `## Unreleased` section above the release.
2. Open a release PR. Review the change and wait for CI on its exact head to
   pass on Node.js 22, 24, and 26 before merging.
3. From the clean merged release commit, with the Emscripten version pinned in
   `.github/workflows/ci.yml` on `PATH`, run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   pnpm test
   pnpm typecheck
   pnpm docs:build
   pnpm pack
   ```

4. Install the resulting tarball in a temporary consumer project and check
   both `libopus-wasm` and `libopus-wasm/discordjs` encode/decode roundtrips.
   Publish that tested tarball, rather than rebuilding on the publishing host:

   ```sh
   npm publish /path/to/libopus-wasm-X.Y.Z.tgz --access public
   ```

5. Tag the merged commit as `vX.Y.Z` and push the tag. Create a published GitHub
   Release with the exact changelog section, plus links to the npm version,
   registry tarball, release commit, and CI proof. Include the registry integrity
   value and attach the tested tarball if desired.
6. Verify that the GitHub Release is not a draft, its notes match the changelog,
   and npm reports the version, `latest` dist-tag, tarball URL, integrity, and
   publication time:

   ```sh
   npm view libopus-wasm@X.Y.Z version dist-tags dist time --json
   ```

Leave `main` clean and up to date, preserve the empty `Unreleased` section, and
remove temporary consumer directories and local release artifacts.
