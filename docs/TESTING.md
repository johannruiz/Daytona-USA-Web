# Testing

## No-ROM checks

```sh
npm install
npm test
```

The Node tests cover first-run settings, preservation of saved settings/credits, invalid storage fallback, and the rumble scheduler's quiet state, two motor channels, centring effect priority and independent intensity, comfortable output limits, refresh rate, pause/off/disconnect, unsupported hardware and asynchronous failures. Actuators are simulated; these checks do not establish physical vibration quality.

The C++ bridge test `tests/centring-board.cpp` checks the actual helper used by the engine against the upstream DriveBoard model: progressive response across the complete ADC travel, symmetry, commanded strength, both dead zones, motor-off and effect selection. With Emscripten configured:

```sh
em++ tests/centring-board.cpp -Iupstream/src -O0 -sENVIRONMENT=node -o build/centring-board-test.cjs
node build/centring-board-test.cjs
```

## Desktop browser checks

Install Chrome and build the game. Start `node scripts/serve.js dist 8080`. In a second PowerShell terminal:

```powershell
$env:TEST_ROM='C:/path/to/your/daytona.zip'
npm run test:browser
```

This uses Playwright/Chrome and exercises real game boot/attract, NVRAM storage, modal pause/resume, default Enhanced, native 1080p, ultrawide, simulated pixel density ×2, Classic switching and UI layout. Without TEST_ROM, the browser test exercises synthetic WebGPU colors, clipping and layer composition, but still needs a complete compiled application for startup.

The test enables Chrome's unsafe WebGPU flag for local validation. That test flag is not evidence that every ordinary public browser configuration supports WebGPU. Check an ordinary browser launch on target devices before claiming support.

## Player settings checks

Run `npm run test:settings` against the local server. This checks the main vibration toggle, category switching, keyboard tabs and focus trapping, Back/Escape, the 100%/5% controller defaults, saved preferences, disabled sliders with retained values, adjustable joystick sensitivity, desktop 2x/mobile 1x defaults, mobile layout, and the real compiled engine's distance levels 0/1/2. It also feeds synthetic samples through the host's actual Web Audio gain node and measures volume scaling, silence and mute retention. No ROM or physical controller is used; this does not validate racing performance at 2x or physical feedback quality. Screenshots are saved under ignored `build/`.

## Experimental wheel checks

Run `npm run test:wheel` against the local server. It exercises live assignment, actual UI calibration, separate/inverted USB pedals, hat directions and gear positions, Escape cancellation, saved profiles, keyboard navigation and mobile layout using injected Gamepad fixtures. A second page spies on the WASM input boundary while keeping production input code; it checks wheel priority, steering/pedal/button forwarding, keyboard override and unplug neutralisation. The boundary is a stand-in and does not simulate a race or establish physical-wheel compatibility. The Node wheel tests additionally cover combined pedals, reversed/asymmetric steering, analog button pedals, single-press paddles, index changes, duplicate-ID ambiguity, legacy hats and invalid profiles. Screenshots go to ignored `build/`.

Physical validation should record the wheel/pedal/shifter models, OS, driver, connection mode and browser. Check calibration at rest and both limits, gradual steering, independent pedals, all assigned buttons, disconnect/reconnect and a real race. Check devices whose browser exposes multiple logical controllers or duplicate IDs separately.

## Phone input emulation

```powershell
$env:TEST_ROM='C:/path/to/your/daytona.zip'
npm run test:mobile
```

Requires the local server and installed Chrome. Checks simultaneous steering/gas, separate releases, cancellation, brake, gear shift, camera, pause, settings panel availability and portrait/landscape canvas behavior. It also checks pinch/double-tap zoom suppression, selection and context-menu guards, real non-silent stereo audio scheduling, touch audio activation, mute persistence, and a simulated Safari audio-session/interruption branch. The audio session probe runs in Chrome; it does not establish physical iPhone speaker output. Evidence goes to ignored `build/` files. No ROM is part of the test repository.

## Manual release checks

Check a real race on each track, all camera views, keyboard/gamepad/touch, sound and mute, repeated imports, tab switching, saving/reloading, fullscreen and orientation changes. Compare Classic with Enhanced +1 for scenery popping and performance. Record browser/OS/device and whether hardware or emulation was used. A high display FPS counter does not by itself prove full-speed game simulation or audio correctness.

The owner reports stable 30 FPS on iPhone, with no sound before the mobile audio fix. Physical iPhone speaker output after this fix, Android coverage, audio fidelity and exhaustive track coverage remain open. Current renderer validation uses the real engine and WebGPU composition checks.
