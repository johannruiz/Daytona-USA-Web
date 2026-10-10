# Publish this compiled package on GitHub Pages

1. Extract the ZIP locally.
2. Create a GitHub repository or use an existing repository's publishing branch.
3. Upload the extracted contents, including hidden `.nojekyll`, to the root of that branch. Index.html and daytona_engine.wasm must be directly in the publishing root, not under web/ or a wrapper folder.
4. Open Settings → Pages → Deploy from a branch, choose that branch and / (root), then Save.
5. Wait for deployment and open the HTTPS URL shown by GitHub. Select your own supported ROM ZIP in the browser.

The engine is already compiled. Uploading the ZIP alone will not publish its contents. The package's .gitignore explicitly permits the compiled root engine files when uploading through Git.

Local test: run `node serve.js . 8080` from the extracted folder, then open http://localhost:8080.

No ROM ZIP is included. The compiled engine contains recompiled game program instructions; see NOTICE.md for software and game-asset scope.
