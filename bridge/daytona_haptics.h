#pragma once
#include "runtime/drive_board.h"

namespace webhaptics {
// Use the arcade ADC position actually delivered to the I/O board, including
// its quantisation, rather than the raw host joystick axis.
inline float centring(const rt::DriveBoard &drive, uint8_t steering_adc) {
    using Effect = rt::DriveBoard::Effect;
    if (drive.effect != Effect::Centre && drive.effect != Effect::CentreDeadZone)
        return 0.0f;
    const float wheel = std::clamp((int(steering_adc) - 0x80) / 96.0f, -1.0f, 1.0f);
    // The arcade spring reaches its plateau very near the centre. Attenuate
    // that actual force across the remaining steering travel so its rumble
    // translation grows gradually, without altering the board's force model.
    const float dead = drive.effect == Effect::CentreDeadZone ? 0.06f : 0.02f;
    const float travel = std::clamp((std::fabs(wheel) - dead) / (1.0f - dead), 0.0f, 1.0f);
    return std::fabs(drive.motor(wheel)) * travel;
}
} // namespace webhaptics
