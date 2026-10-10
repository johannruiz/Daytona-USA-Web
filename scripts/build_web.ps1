param(
    [string]$Repo = "$PSScriptRoot/../upstream",
    [string]$GenRoot = "$Repo/build-host/gen",
    [string]$Sdk = "$PSScriptRoot/../tools/emsdk"
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path "$PSScriptRoot/..").Path
$Repo = (Resolve-Path $Repo).Path
$GenRoot = (Resolve-Path $GenRoot).Path
$Sdk = (Resolve-Path $Sdk).Path
$env:EMSDK_PYTHON = "$Sdk/python/3.13.3_64bit/python.exe"
$env:PATH = "$projectRoot/tools/python/cmake/data/bin;$projectRoot/tools/python/bin;$Sdk;$Sdk/upstream/emscripten;$env:PATH"
& $env:EMSDK_PYTHON "$projectRoot/scripts/apply_web_port.py" $Repo
if ($LASTEXITCODE) { throw 'No se pudo instalar el port' }
& "$Sdk/upstream/emscripten/emcmake.bat" cmake -S $Repo -B "$Repo/build-web" -G Ninja -DCMAKE_BUILD_TYPE=Release -DM2_ROMSET=daytona -DM2_SOFTFLOAT_PORTABLE=ON "-DM2_GEN_ROOT=$GenRoot"
if ($LASTEXITCODE) { throw 'Falló CMake' }
& cmake --build "$Repo/build-web" --target daytona_web --parallel 4
if ($LASTEXITCODE) { throw 'Falló la compilación WebAssembly' }
$out = "$projectRoot/dist"
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item "$Repo/build-web/web/*" $out -Force
Copy-Item "$projectRoot/LICENSE","$projectRoot/THIRD_PARTY.md" $out -Force
Copy-Item "$projectRoot/web/LEEME.txt" $out -Force
Copy-Item "$projectRoot/scripts/serve.js" $out -Force
Write-Host "Compilación lista: $out"
