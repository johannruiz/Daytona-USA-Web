# Deployment

## Local use

Build first, then run `node scripts/serve.js dist 8080`. The development server binds to 127.0.0.1, serves only local files and intentionally has no public upload API. It is not a public production server.

WebGPU requires a secure context. Desktop localhost is acceptable. A phone opening an HTTP address on another computer is not accessing its own localhost; use HTTPS for a phone deployment.

## Static hosting and GitHub Pages

The browser app can be served as static files after compilation. Relative asset URLs support a project subdirectory. The source repository root is not the runnable output: it has no compiled engine. Do not expect enabling Pages on the source root to produce a playable game.

Before publicly hosting a build, resolve the distribution scope described in NOTICE.md and RELEASE.md. There is no automatic Pages deployment workflow in this package, and no game engine artifact is included in the source archive.

For an authorized static deployment, serve the complete build directory over HTTPS. The host must return `.wasm` as `application/wasm`, JS as a JavaScript MIME type, and provide the WGSL and image assets. Deploy engine JS/WASM together; avoid stale caches mixing builds. This build uses no WebAssembly threads and does not require cross-origin isolation headers solely for threading.

The ROM picker reads the selected ZIP into the browser's local WebAssembly filesystem. The existing frontend contains no ROM-upload request. Users still need the supported revision. Local saves belong to the browser/origin; moving the deployment to another origin does not transfer them.

## Before claiming phone support

Test on physical devices using HTTPS: first launch, ROM import, attract mode, race, sound, fullscreen behavior where available, multitouch, portrait/landscape, safe areas, tab switching and saved settings. Record device, OS, browser, performance and thermal behavior. Touch emulation verifies event handling and layout, not real phone GPU support or speed.

## Manual GitHub Pages publication

Technically, this compiled app can run on GitHub Pages, with each visitor selecting their own supported ROM locally. Pages supplies HTTPS and serves the app's static files. Browser WebGPU support and the correct ROM remain requirements. The engine itself is precompiled; Pages does not compile the user's ROM on demand.

After deciding to publish the compiled engine described in NOTICE.md:

1. Create a separate publishing branch named `gh-pages` in your repository. Keep it separate from the source branch and its build-artifact ignore rules.
2. Upload the **contents** of the complete local `dist/` output to the root of that branch, including index.html, engine JS/WASM, renderer, WGSL, controls, styles and logo. Add LICENSE, THIRD_PARTY.md and NOTICE.md. Never upload the ROM ZIP.
3. Add an empty `.nojekyll` file at that publishing root to use the static output directly. A copy is provided at docs/pages/.nojekyll.
4. In GitHub repository Settings → Pages, choose Deploy from a branch, select `gh-pages` and `/ (root)`, then Save. Use HTTPS / Enforce HTTPS when available.
5. Open the published project URL, typically `https://OWNER.github.io/REPOSITORY/`, and test ROM import, audio, controls and saves in a normal browser. Test physical phones before advertising them as supported.

This guide performs no upload or deployment. Publishing the source archive alone does not publish the playable engine.

Official references: [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [HTTPS on GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).
