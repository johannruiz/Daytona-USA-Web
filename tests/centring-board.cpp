// Compile with Emscripten, -Iupstream/src; no game assets are required.
#include "../bridge/daytona_haptics.h"
#include <cassert>
#include <cstdio>

int main() {
    rt::DriveBoard drive;
    auto cue = [&](uint8_t adc) { return webhaptics::centring(drive, adc); };
    drive.command(0x3b);
    assert(cue(0xe0) == 0); // Motor off, even with a spring command.
    drive.command(0x07);
    assert(cue(0x80) == 0);
    assert(cue(0x85) == 0 && cue(0x7b) == 0); // Actual ADC dead zone.
    const float spring = drive.level(rt::DriveBoard::Effect::CentreDeadZone);
    assert(cue(0x87) > 0 && cue(0x87) < spring);
    assert(cue(0x87) == cue(0x79)); // Symmetric left/right, quantised ADC.
    assert(cue(0x8e) > cue(0x87) && cue(0x8e) < spring * 0.1f);
    assert(cue(0x98) < cue(0xb0) && cue(0xb0) < cue(0xc8));
    assert(cue(0xb0) > spring * 0.45f && cue(0xb0) < spring * 0.5f);
    assert(cue(0xe0) == spring && cue(0x20) == spring);
    for (int offset = 0; offset <= 96; ++offset) {
        const float value = cue(uint8_t(0x80 + offset));
        assert(value == cue(uint8_t(0x80 - offset)));
        assert(value >= 0 && value <= spring);
        if (offset > 6) assert(value > cue(uint8_t(0x80 + offset - 1)));
    }
    // The same steering position reflects the strength actually commanded
    // by the game, rather than a fixed vibration level.
    const float stronger = cue(0xb0);
    drive.command(0x38);
    assert(cue(0xb0) > 0 && cue(0xb0) < stronger);
    drive.command(0x31); // Spring with a smaller dead zone.
    assert(cue(0x83) > 0 && cue(0x81) == 0);
    drive.command(0x57);assert(cue(0xe0) == 0); // Force takes priority.
    drive.command(0x47);assert(cue(0xe0) == 0); // Uncentring takes priority.
    drive.command(0x27);assert(cue(0xe0) == 0); // No invented resistance cue.
    drive.command(0x3b);drive.command(0x01);assert(cue(0xe0) == 0);
    std::puts("Centring bridge passed: progressive full-travel response, symmetry, real commanded strength, ADC dead zones, motor off and effect priority.");
}
