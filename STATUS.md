# Verified status — October 10, 2026

- Upstream commit: 82201ed63668c99a946120bd0b8010b8f9599259.
- Original importer validated the supplied ROM as Revision A, set daytona.
- Native import/recompilation tools compiled with Visual Studio 2022. Generated 38,001 i960 instructions, TGP program and 1,916 68000 instructions.
- Emscripten 4.0.23 Release compilation and linking completed. Real engine JS/WASM are in dist.
- Real WebGPU on Chrome/NVIDIA Turing: shader and pipeline creation, BGRA conversion, polygon clipping and 2D layer composition verified.
- Original game attract mode, track selection and player race previously observed in an interactive session exceeding 15,000 game frames.
- New default EEPROM derived using the original arcade test menu: LINK ID SINGLE and COUNTRY EXPORT. Fresh backup RAM contains no inserted credits.
- Fresh-save browser test reached more than 600 game frames in attract mode with CREDIT 0/1 and no console errors. Evidence: build/new-attract.png and build/browser-errors.json.
- New desktop/mobile import modal, controls guide, Escape pause/resume and absence of a frames UI verified. Evidence: build/new-launcher-desktop.png and build/new-launcher-mobile.png.
- Enhanced is selected by default. The rebuilt engine widens real geometry and WebGPU rasterizes at window resolution; Classic restores 496 × 384.
- Real-game browser checks passed at 1280 × 720, 1920 × 1080, 2560 × 720 ultrawide, and 2560 × 1440 with device pixel ratio 2. Switching to Classic and back worked in the same session. Evidence: build/enhanced-1080p.png, build/enhanced-ultrawide.png and build/classic-attract.png.
- The new transparent logo is displayed directly on the modal. The audio checkbox is replaced by the mode switch; sound loads automatically.
- Three NVRAM tests pass: first-run defaults, existing saved settings/credits preserved, and invalid or inaccessible storage fallback.

3D geometry is rasterized in WebGPU. System 24 layers retain original CPU composition. Audio fidelity, all tracks, gamepads and browsers have not been exhaustively validated. Legacy stub fixtures were removed. Current validation uses the real engine and tests/browser-smoke.cjs.

## Draw distance and phone controls

Enhanced enables only draw distance +1; Classic uses level 0. The generated Revision A program contains rt::hook_draw_list, which expands the scenery list to the full 5×5 grid and raises the original geometry budget from 5,000 to 10,000.

The rebuilt engine ran in Chrome with emulated phone touch input. Simultaneous steering and gas, independent release, cancellation, braking, shifting, camera changes, menu pause and portrait/landscape rendering passed. Evidence: build/mobile-landscape-game.png, build/mobile-portrait-game.png and build/mobile-errors.json. Portrait preserves the full arcade HUD; landscape widens the view. The owner reports stable 30 FPS on iPhone, with no sound before the mobile audio fix.

The driving surface now suppresses zoom, selection and long-press menus without restricting the separate launcher. Audio uses the device output rate, requests Safari's playback session, unlocks within the start tap and retries after interruption on a driving tap. A mobile sound toggle preserves mute through pause/resume. Automated checks use real Chrome audio and a simulated Safari session/interruption; physical iPhone speaker output after the fix still needs confirmation.
