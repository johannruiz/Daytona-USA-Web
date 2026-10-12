# Preparing a community release

## Current recommendation

Publish this as an **experimental source preview**. A suggested first tag is `v0.1.0-preview`; it has not been created. Do not advertise stable universal browser/phone support. The current validation is desktop Chrome/NVIDIA plus emulated phone touch input.

## Public source package

Include the port sources, supported tests, build helpers, documentation, issue templates and required software notices. Exclude `upstream/`, `tools/`, `dist/`, `build/`, ROM archives, extracted chips, generated processor sources, compiled engines, local logs, credentials and dependency caches. When preparing a source-only archive, copy only the source/documentation files in this working tree and omit the local generated directories.

The user-supplied logo is present so the frontend and existing build helpers remain complete. Its separate permission/provenance still needs an owner decision before public release; the software license does not cover the branding. See NOTICE.md.

## Binary or playable releases

The local `daytona_webgpu_github_pages.zip` is the compiled Pages distribution, not a source-only archive. Its engine contains recompiled game program instructions from the user's ROM even though the ZIP does not contain the original ROM ZIP. Do not treat the runtime ROM picker as proof that a compiled release contains no game-derived code. Resolve that distribution decision separately before uploading engine binaries or deploying a public playable site.

## Checklist

- Confirm license notices and logo/branding distribution scope.
- Read BUILD.md and verify it from a clean machine; current documentation follows the verified local build stages but is not a fresh-machine certification.
- Run Node, desktop browser and phone-emulation checks; record results honestly.
- Test normal browser launches and physical target devices before adding them to a supported-device list.
- Review `git status` and `git ls-files`; ensure no ignored build data was force-added.
- Use CHANGELOG.md and .github/RELEASE_TEMPLATE.md for release notes.
- If publishing only source, upload the source archive, not the local compiled package.

## Create a GitHub repository later

Create an empty repository in your account. For a source-only repository, first copy the source/documentation files to a clean folder without build output, then open a terminal in that folder. Replace the remote placeholder with the repository URL you created:

```sh
git init -b main
git add .
git status --short
git commit -m "Prepare experimental Daytona WebGPU community source preview"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Review the staged list before committing. The commands are instructions for the owner; no remote, commit, tag or upload was performed by preparing these files. Enable Issues and private vulnerability reporting if desired. A Pages deployment is a separate operation.
