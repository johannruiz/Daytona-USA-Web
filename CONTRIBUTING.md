# Contributing

This is a community preview. Start with README.md, BUILD.md and STATUS.md. Report reproducible failures using the issue templates and distinguish desktop testing, phone emulation and testing on physical phones.

## Scope

Keep Classic faithful to the original resolution, aspect and draw distance. Enhanced currently adds native window resolution, widescreen and draw distance +1. New visual effects should be separately proposed and tested. Touch controls should support simultaneous pointers, release/cancel, orientation changes, safe areas and pause without stuck input.

## Changes

Use a small focused branch and explain the problem, resulting behavior, test environment and remaining limitations. Preserve upstream attribution and shader/runtime notices. Changing the pinned engine requires reviewing the installer patches and rebuilding the generated programs from the supported revision.

Run `npm test`. Rendering or input changes also need the relevant browser tests in docs/TESTING.md. A browser test pass is not a substitute for a physical-device test. Keep new user-facing text in English.

## Data and files

Do not attach or commit ROM ZIPs, extracted chip images, generated game programs, compiled engine WASM, private paths, tokens or local saves containing personal information. Do not upload the build folder to issues. Describe the identified ROM revision without sharing the ROM. Public releases should follow docs/RELEASE.md.

## Community conduct

Discuss code and behavior respectfully. Give clear reproduction steps and allow maintainers time to respond. Harassment, personal attacks and requests for ROM downloads are outside this project's collaboration scope.
