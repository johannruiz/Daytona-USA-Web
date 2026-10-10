# Daytona USA WebGPU

A browser port of [daytona-arcade-recomp](https://github.com/alphanu1/daytona-arcade-recomp), powered by **WebAssembly and WebGPU**.

Play Daytona USA directly in your browser with widescreen rendering, native window resolution, keyboard and gamepad support, and touch controls for phones. Tested on multiple computers with good performance and no reported errors in those sessions.

## Features

- Original recompiled i960, TGP and 68000 game programs.
- WebGPU rendering for 3D geometry.
- **Enhanced mode**, enabled by default:
  - Native window resolution, including display pixel density.
  - Widescreen camera that reveals additional scenery.
  - Increased scenery draw distance at level **+1**.
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

For local use, follow [BUILD.md](BUILD.md), then run:

```sh
node scripts/serve.js dist 8080
```

Open [localhost:8080](http://localhost:8080). Opening `index.html` through `file://` is not supported.

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
| Shift down / up | LB / RB |
| Insert coin | Back / Select |
| Start | Start |
| Camera views | A / B / X / Y |

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

Arcade settings and backup RAM are saved in your browser’s local storage.

Saves are specific to the browser and website address. Clearing site data removes them. This is arcade persistence, not an emulator save-state system.

## Building and hosting

This repository contains the web frontend, engine bridge, shaders, build helpers and documentation. It does not include ROMs, generated processor sources or the compiled game engine.

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

See [LICENSE](LICENSE), [THIRD_PARTY.md](THIRD_PARTY.md) and [NOTICE.md) for software attribution and asset scope.

Daytona USA and SEGA branding remain separate from the software license. This is an independent community project with no implied affiliation or endorsement.

The compiled WebAssembly engine contains game instructions recompiled from the supplied ROM. Review the distribution scope before publishing compiled binaries or a playable deployment.
