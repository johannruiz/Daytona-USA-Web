param([Parameter(Mandatory=$true)][string]$Rom,[string]$Repo="$PSScriptRoot/../upstream")
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path "$PSScriptRoot/..").Path
$Repo=(Resolve-Path $Repo).Path
$Rom=(Resolve-Path $Rom).Path
$cmake="$projectRoot/tools/python/cmake/data/bin/cmake.exe"
if (!(Test-Path $cmake)) { $cmake='cmake' }
$build="$Repo/build-host"
& $cmake -S $Repo -B $build -G 'Visual Studio 17 2022' -A x64 -DM2_ROMSET=daytona
if ($LASTEXITCODE) {throw 'Falló la configuración nativa'}
& $cmake --build $build --config Release --target m2import m2recomp m2tgprecomp m2sndrecomp --parallel 4
if ($LASTEXITCODE) {throw 'Falló la compilación de las herramientas'}
$cache="$build/rom_cache/daytona"
& "$build/Release/m2import.exe" $Rom $cache
if ($LASTEXITCODE) {throw 'ROM rechazada por el importador original'}
foreach ($name in 'daytona','daytona_tgp','daytona_snd') {New-Item -ItemType Directory -Force "$build/gen/$name" | Out-Null}
& "$build/Release/m2recomp.exe" "$cache/program.bin" "$build/gen/daytona" --seeds "$Repo/seeds/daytona.txt" --hooks "$Repo/seeds/daytona_hooks.txt"
if ($LASTEXITCODE) {throw 'Falló la recompilación i960'}
& "$build/Release/m2tgprecomp.exe" "$cache/tgp_program.bin" "$build/gen/daytona_tgp/tgp_gen.cpp"
if ($LASTEXITCODE) {throw 'Falló la recompilación TGP'}
& "$build/Release/m2sndrecomp.exe" "$cache/sound_program.bin" "$build/gen/daytona_snd/snd_gen.cpp"
if ($LASTEXITCODE) {throw 'Falló la recompilación 68000'}
