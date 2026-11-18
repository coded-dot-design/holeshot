# Contributing

Pull requests welcome. Before you open one, run `npm run check`, `npm test`, `npm run test:settle`, `npm run test:browser`, `npm run site:build` and `npm run test:site`, and keep them green (no runtime dependencies; `dist/` is committed and must be the build of the commit).

## Releases

The version in `package.json` is the one the site shows (the V… in its header). To cut a release:

1. Move the CHANGELOG's `## Unreleased` notes under `## X.Y.Z` with the date, and bump `package.json`
   and both top-level version fields of `package-lock.json` to the same version (a feature round is a
   minor bump, fixes only a patch).
2. Rebuild `dist/` (`npm run check`) and run every check above.
3. Merge to `main`. Once CI is green it tags that commit `vX.Y.Z` (the `tag-version` job); a version
   that is already tagged does nothing, so only a bump makes a tag.

Earlier releases, tagged by hand on the commit that set each version:
`git tag v0.1.0 3381705 && git tag v0.2.0 056c125 && git tag v0.2.1 7988f56 && git tag v0.3.0 ca20905 && git push origin --tags`.
