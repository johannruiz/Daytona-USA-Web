# Build from source

The verified local build used Windows, Visual Studio 2022, Emscripten 4.0.23, CMake and Ninja. The steps below document the same dependency pins and build stages using ordinary installed tools. A clean-machine run of this guide has not yet been verified.

## Windows prerequisites

Install Git, Python 3, Node.js (the local test runtime was 24.19), CMake 3.20 or newer, Ninja, and Visual Studio 2022 / Build Tools with Desktop development with C++ and a Windows SDK. Ensure `git`, `python`, `node`, `cmake` and `ninja` work in PowerShell. Use a Visual Studio developer terminal if compiler discovery fails.

Run the following from this port's root. Do not put your ROM in tracked source files.

## Fetch pinned engine and runtime dependencies

```powershell
git clone https://github.com/alphanu1/daytona-arcade-recomp.git upstream
git -C upstream checkout 82201ed63668c99a946120bd0b8010b8f9599259
git clone https://github.com/ucb-bar/berkeley-softfloat-3.git upstream/extern/softfloat
git -C upstream/extern/softfloat checkout a0c6494cdc11865811dec815d5c0049fba9d82a8
git clone https://github.com/aaronsgiles/ymfm.git upstream/extern/ymfm
git -C upstream/extern/ymfm checkout 81aec25ccbb98f4873a255f7551ac4dadac59b4a
```

SDL and ImGui are not required for this browser frontend. ZIP import works without the optional 7-Zip SDK; this port's UI accepts ZIP only. The upstream setup script may fetch additional native-platform dependencies if you choose to use it.

## Install Emscripten

```powershell
git clone https://github.com/emscripten-core/emsdk.git tools/emsdk
./tools/emsdk/emsdk.bat install 4.0.23
./tools/emsdk/emsdk.bat activate 4.0.23
./tools/emsdk/emsdk_env.ps1
```

Keep the SDK environment active in the same terminal. Emscripten's own bundled Python/Node are local SDK components, not part of this repository.

## Import and generate the supported game programs

Replace the example path with your own Revision A (1994), set `daytona` ZIP:

```powershell
./scripts/prepare_rom.ps1 -Rom 'C:/path/to/your/daytona.zip'
```

This builds the native importer and recompilers, validates the chips and generates i960/TGP/68000 C++ under `upstream/build-host/gen`. Do not commit that directory. No ROM upload or download service is part of this process.

## Install the port and compile WebAssembly

The commands below avoid the machine-specific bundled-tool paths expected by the convenience `build_web.ps1` script:

```powershell
python scripts/apply_web_port.py upstream
$daytonaGenRoot = (Resolve-Path 'upstream/build-host/gen').Path
emcmake cmake -S upstream -B upstream/build-web -G Ninja -DCMAKE_BUILD_TYPE=Release -DM2_ROMSET=daytona -DM2_SOFTFLOAT_PORTABLE=ON "-DM2_GEN_ROOT=$daytonaGenRoot"
cmake --build upstream/build-web --target daytona_web --parallel 4
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item upstream/build-web/web/* dist -Force
Copy-Item LICENSE,THIRD_PARTY.md,NOTICE.md dist -Force
Copy-Item web/LEEME.txt,scripts/serve.js dist -Force
node scripts/serve.js dist 8080
```

Do not proceed to the next stage if a command fails. Release optimization of the generated game can take several minutes. Serve the complete output: HTML, JS, WGSL, CSS, PNG, and WASM. `daytona_engine.js` and `daytona_engine.wasm` must be from the same build.

## Linux and macOS

The shell build helper exists but this port has not been freshly validated on these hosts. Install Git, a C++20 compiler, Python 3, CMake, Ninja, Node and Emscripten 4.0.23. Fetch the engine/dependencies at the pins above. Put your supported ROM locally at `upstream/roms/daytona.zip`, then:

```sh
cmake -S upstream -B upstream/build-daytona -G Ninja -DCMAKE_BUILD_TYPE=Release -DM2_ROMSET=daytona
cmake --build upstream/build-daytona --target m2import m2recomp m2tgprecomp m2sndrecomp
python3 upstream/scripts/recompile.py --set daytona --build-dir build-daytona
# Activate the Emscripten SDK environment first.
bash scripts/build_web.sh upstream
```

Output is under `upstream/build-web/web`. Include LICENSE, THIRD_PARTY.md and NOTICE.md when creating a local distribution. The upstream recompilation helper also builds its native game target; it is not a web-only operation.

## Updating

Keep the documented upstream commit until a new revision is reviewed. The installer patches only the cloned engine and copies `bridge/` + `web/` into its browser platform directory. When changing pins or recompilation hooks, regenerate from the same supported ROM and rebuild; do not mix stale generated programs or engine files.
