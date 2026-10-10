# Testing

## No-ROM checks

```sh
npm install
npm test
```

The current Node tests cover first-run settings, preservation of valid saved settings/credits, and invalid or inaccessible storage fallback.

## Desktop browser checks

Install Chrome and build the game. Start `node scripts/serve.js dist 8080`. In a second PowerShell terminal:

```powershell
$env:TEST_ROM='C:/path/to/your/daytona.zip'
npm run test:browser
```

This uses Playwright/Chrome and exercises real game boot/attract, NVRAM storage, modal pause/resume, default Enhanced, native 1080p, ultrawide, simulated pixel density ×2, Classic switching and UI layout. Without TEST_ROM, the browser test exercises synthetic WebGPU colors, clipping and layer composition, but still needs a complete compiled application for startup.

The test enables Chrome's unsafe WebGPU flag for local validation. That test flag is not evidence that every ordinary public browser configuration supports WebGPU. Check an ordinary browser launch on target devices before claiming support.

## Phone input emulation

```powershell
$env:TEST_ROM='C:/path/to/your/daytona.zip'
npm run test:mobile
```

Requires the local server and installed Chrome. Checks simultaneous steering/gas, separate releases, cancellation, brake, gear shift, camera, pause, settings panel availability and portrait/landscape canvas behavior. Evidence goes to ignored `build/` files. No ROM is part of the test repository.

## Manual release checks

Check a real race on each track, all camera views, keyboard/gamepad/touch, sound and mute, repeated imports, tab switching, saving/reloading, fullscreen and orientation changes. Compare Classic with Enhanced +1 for scenery popping and performance. Record browser/OS/device and whether hardware or emulation was used. A high display FPS counter does not by itself prove full-speed game simulation or audio correctness.

Physical Android/iPhone coverage, audio fidelity and exhaustive track coverage remain open. The historical bridge fixture tests are not current renderer validation.
