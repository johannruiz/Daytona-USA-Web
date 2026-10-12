# Daytona USA WebGPU

A browser port of [daytona-arcade-recomp](https://github.com/alphanu1/daytona-arcade-recomp), powered by **WebAssembly and WebGPU**.

Play Daytona USA directly in your browser with widescreen rendering, native window resolution, keyboard and gamepad support, and touch controls for phones. Tested by the project owner on multiple computers with good performance and no reported errors in those sessions.

## Features

- Original recompiled i960, TGP and 68000 game programs.
- WebGPU rendering for 3D geometry.
- **Enhanced mode**, enabled by default:
  - Native window resolution, including display pixel density.
  - Widescreen camera that reveals additional scenery.
  - Increased scenery draw distance: **+2** by default on desktop, **+1** on mobile.
- **Classic mode** with the original resolution, aspect ratio and draw distance.
- Arcade-inspired interface with local ROM import.
- Keyboard, standard gamepad and multitouch controls.
- Automatic arcade audio with a mute button.
- Local persistence for arcade settings and backup RAM.
- A discreet FPS counter.

On a fresh save, the game starts with **Single cabinet, Export region and zero credits**, allowing attract mode to play automatically. Existing saves retain their settings and credits.

## Requirements

- A browser and device with **WebGPU support**.
- **HTTPS or localhost**.
- Your own **Daytona USA Revision A (1994), set `daytona`**, ROM ZIP.

The importer validates the ROM contents. A ZIP filename alone does not identify its revision. Other revisions, including the `daytona93` set, are not supported by this build.

## Playing

On a deployed website:

1. Open the game in a WebGPU-compatible browser.
2. Select your supported ROM ZIP.
3. Choose **Enhanced** or **Classic**.
4. Select **Enter arcade**.
5. Watch attract mode, or insert a coin and start playing.

The selected ROM is processed locally inside your browser. The frontend does not upload it to a server.

This compiled package includes index.html and its engine files directly at the root. For local use, run:

```sh
node serve.js . 8080
```

Open [localhost:8080](http://localhost:8080). Opening `index.html` through `file://` is not supported.

## GitHub Pages

Upload the **extracted contents** of this package to your chosen publishing branch. Keep `index.html`, `.nojekyll`, the engine JS/WASM and frontend assets together at the repository root. Do not upload only the ZIP or nest the files inside another folder.

In **Settings → Pages**, select **Deploy from a branch**, choose that branch and **/ (root)**, then Save. Open the HTTPS URL GitHub provides after deployment. See [GitHub Pages setup](docs/PAGES_QUICKSTART.md).

## Controls

### Keyboard

| Action | Key |
| --- | --- |
| Steer | Left / Right arrows |
| Accelerate | Up arrow |
| Brake | Down arrow |
| Insert coin | 5 |
| Start | Enter |
| Select gear | 1–4 |
| Shift down / up | Q / W |
| Camera views | A / S / D / F |
| Arcade settings | F2 |
| Service button | F3 |
| Pause and open menu | Esc |

**Use the accelerator to confirm course and car selections.**

F2 opens the original arcade settings. Inside that menu, **F/S** moves the cursor, **D/S** changes values, and **Enter** selects. Choose **EXIT** to return to the game.

### Standard gamepad

| Action | Control |
| --- | --- |
| Steer | Left stick |
| Accelerate / brake | RT / LT |
| Gears 1 / 2 / 3 / 4 | B / A / X / Y |
| Shift down / up | LB / RB |
| Insert coin | Back / Select |
| Start | Start |
| Camera views 1 / 2 / 3 / 4 | D-pad ↑ / → / ↓ / ← |

The left stick uses an 8% dead zone and a progressive response for gentler steering near the center, with full steering available at either end.

Controller vibration follows the original game's arcade drive-board commands, using the same force/uncentring conversion as the native frontend. It does not infer collisions, gear changes or road surfaces from player inputs. The controls menu offers intensity from Off to 100%, saved locally, with a 100% default and a maximum motor output of 65%. Vibration stops on pause, loss of focus, disconnect or ROM replacement; short effects also expire if frames stop. Availability depends on browser, platform and controller support for dual rumble.

The separate **Centring** setting defaults to 5%. It translates the existing arcade board model's centring force into a quiet large-motor cue, using the actual steering ADC delivered to the game and the board's spring ramp/dead zone. Because the arcade spring saturates near the centre, its rumble translation is attenuated by the remaining steering travel: small turns are gentle, and the cue grows continuously towards full steering. The underlying force model is unchanged, and the cue still scales with the strength commanded by the game. Force/uncentring effects take priority. This cue is capped at 15% motor output, is silent at the centre or when the board's motor is off, and follows the master vibration intensity. Set Centring to Off to retain only the other effects. Resistance remains silent; no vehicle shake is invented.

### Phone

Touch controls appear during gameplay:

- Drag the **left thumb pad** to steer.
- Hold **GAS** or **BRAKE** with your right thumb.
- Tap **− / +** to shift gears.
- Tap **VIEW** to cycle camera views.
- Tap **COIN** to insert credit and **START** to begin.
- Tap **☰** to pause and open the menu.
- Tap **⋯** to reveal F2, service and arcade menu controls.

Steering and pedals support simultaneous touches. Landscape provides the widest view; portrait preserves the complete original HUD.

## Saves

Arcade settings and backup RAM are saved in your browser's local storage.

Saves are specific to the browser and website address. Clearing site data removes them. This is arcade persistence, not an emulator save-state system.

## Building and hosting

Alongside the compiled application, this package includes the web frontend, engine bridge, shaders, build helpers and documentation. The user's ROM ZIP, extracted ROM files and generated processor sources are not included.

- [Build instructions](BUILD.md)
- [Hosting and GitHub Pages](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)
- [Verified project status](STATUS.md)
- [Release preparation](docs/RELEASE.md)

The port uses upstream commit:

```text
82201ed63668c99a946120bd0b8010b8f9599259
```

## Compatibility notes

Performance depends on your browser, GPU, window resolution and selected mode. Classic reduces rendering demands while preserving the original presentation.

Enhanced retains the original texture and 2D artwork detail. Increased draw distance reduces scenery popping but does not eliminate every appearance change controlled by the game.

Linked-cabinet multiplayer is not implemented in this browser port.

## Contributing

Bug reports, compatibility results and focused improvements are welcome. Include your browser, operating system, hardware, selected mode and reproduction steps.

See [CONTRIBUTING.md](CONTRIBUTING.md). Do not attach ROMs or extracted game data to issues or pull requests.

## Credits and licenses

Based on [daytona-arcade-recomp](https://github.com/alphanu1/daytona-arcade-recomp), by Ben Templeman and contributors.

See [LICENSE](LICENSE), [THIRD_PARTY.md](THIRD_PARTY.md) and [NOTICE.md](NOTICE.md) for software attribution and asset scope.

Daytona USA and SEGA branding remain separate from the software license. This is an independent community project with no implied affiliation or endorsement.

The compiled WebAssembly engine contains game instructions recompiled from the supplied ROM. Review the distribution scope before publishing compiled binaries or a playable deployment.


### Player settings

The main menu offers a controller vibration checkbox and a Settings button. Settings replaces the menu with Graphics, Control and Sound categories; Back or Escape returns to the menu. Changes save automatically on this device and the game stays paused. Turning vibration off retains its intensity settings. The new settings profile starts at 100% vibration and 5% centring; subsequent personal adjustments are preserved.

Graphics offers Classic (original resolution/distance), 1x (mobile default: native resolution, widescreen and engine distance level +1) and 2x (desktop default: engine distance level +2). These labels select the engine's existing scenery levels, not a literal doubling of world distance: +1 draws a 5×5 grid and +2 a 7×7 grid. Sound offers a 0–100% game volume slider through a Web Audio gain node; the existing mute button retains the chosen volume.

Joystick sensitivity is adjustable from 25% to 175%. The 100% default keeps the existing softened response, 8% dead zone and full steering range. Personal sensitivity and graphics selections are saved; device defaults apply when no graphics selection is saved.

### Experimental racing wheels

Open **Settings → Experimental**, press a wheel button if necessary to make it visible, then select the wheel device. Wheel input starts disabled. Assign steering by moving it or choosing its reported axis; capture the centre, full-left and full-right positions. Once valid steering calibration exists, enable **Use configured wheel**. Wheel steering has its own dead zone, inversion and response setting; its default response is linear and does not use the gamepad joystick curve.

Expand **Pedals** to assign accelerator and brake. Capture each released and fully pressed position. This supports inverted axes, analogue buttons, combined pedals sharing an axis, and separate USB pedal devices. Expand **Gears & buttons** for gear positions 1–4, paddles, all four cameras, coin and Start. Buttons can come from a separate shifter/controller; reported hat-switch axes can also be learned. Release controls before starting an assignment and move only the intended control. Escape cancels learning. Live meters, button indicators and raw device inputs let you check the result before racing.

Profiles save locally per browser-reported device ID. Device-index changes are handled when the ID is unique; identical IDs may require reassigning the correct device slot. Disconnected or uncalibrated driving inputs are neutral. A configured wheel takes priority over ordinary controller inputs while available; keyboard/touch input remains usable, and a separate ordinary controller can be used when the wheel is unavailable. No model-specific axis layout is guessed.

This uses the browser's [Gamepad API](https://www.w3.org/TR/gamepad/). Devices that the browser/OS does not expose cannot be configured here; PC mode, manufacturer drivers or another compatible browser may be needed. Manufacturer-specific wheel force feedback is not implemented. Existing rumble is used only if the selected steering device exposes supported dual rumble, using the game's actual drive-board signals. This support has been tested with simulated devices and requires physical-wheel testing before claiming any model is validated.
