// Daytona USA (daytona set) browser host for daytona-arcade-recomp.
// Original game code, board and video renderer are compiled from the upstream
// sources; this module replaces the native SDL3/SDL_GPU platform frontend.
// No Sega assets or generated game code are distributed with this bridge.

#include "runtime/game_loop.h"
#include "runtime/rom_import.h"
#include "runtime/sound_board.h"
#include "runtime/drive_board.h"
#include "daytona_gpu.h"
#include "daytona_haptics.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <exception>
#include <memory>
#include <string>
#include <vector>

namespace {
std::unique_ptr<rt::GameLoop> game;
rt::DriveBoard drive;
webgpu::Frame gpu_frame;
std::string error_message;
std::vector<float> audio_samples;  // interleaved stereo, 48 kHz
int audio_frames = 0;
uint64_t emitted_audio_frames = 0;
double render_scale = 1.0;
int draw_distance = 1;
constexpr double output_rate = 48000.0;
constexpr unsigned char gear_codes[5] = { 0, 2, 1, 6, 5 };

float lerp_stereo(const std::vector<float> &src, double pos, int ch) {
    const size_t count = src.size() / 2;
    if (!count) return 0.0f;
    const size_t i0 = std::min<size_t>(size_t(pos), count - 1);
    const size_t i1 = std::min(i0 + 1, count - 1);
    const float t = float(std::clamp(pos - double(i0), 0.0, 1.0));
    return src[i0 * 2 + ch] + (src[i1 * 2 + ch] - src[i0 * 2 + ch]) * t;
}

void update_audio() {
    audio_frames = 0;
    audio_samples.clear();
    if (!game || !game->sound()) return;
    snd::SoundBoard *snd = game->sound();
    const std::vector<float> fm = snd->take_fm();
    const std::vector<float> pcm = snd->take_pcm();
    const uint64_t target = uint64_t(std::floor(double(game->frames()) * output_rate / rt::GameLoop::kFrameHz));
    const uint64_t count = target > emitted_audio_frames ? target - emitted_audio_frames : 0;
    emitted_audio_frames = target;
    if (count > 2048) return;
    audio_frames = int(count);
    audio_samples.resize(count * 2);
    const double fm_count = double(fm.size() / 2);
    const double pcm_count = double(pcm.size() / 2);
    for (size_t i = 0; i < count; ++i) {
        const double pos_fm = count ? (double(i) + .5) * fm_count / double(count) - .5 : 0;
        const double pos_pcm = count ? (double(i) + .5) * pcm_count / double(count) - .5 : 0;
        for (int channel = 0; channel < 2; ++channel) {
            // The native audio frontend combines the already calibrated YM3438
            // and MultiPCM outputs. This web host resamples each stream.
            const float sum = lerp_stereo(fm, std::max(0.0, pos_fm), channel) +
                              lerp_stereo(pcm, std::max(0.0, pos_pcm), channel);
            audio_samples[i * 2 + channel] = std::clamp(sum, -1.0f, 1.0f);
        }
    }
}
} // namespace

extern "C" {
// Return 1 on success, 0 on failure; read daytona_error() on failure.
int daytona_load(const char *zip_path, int enable_audio) {
    game.reset();
    drive = rt::DriveBoard{};
    error_message.clear();
    audio_frames = 0;
    audio_samples.clear();
    emitted_audio_frames = 0;
    if (!zip_path || !*zip_path) { error_message = "Choose a Daytona USA Revision A (1994) ROM ZIP."; return 0; }
    try {
        rt::M2Board::Images images = rt::import_rom_set(zip_path);
        // Verify expected TGP microcode. The C++ game code must have been
        // generated from this exact supported ROM revision on the host.
        (void)rt::tgp_program(images);
        game = std::make_unique<rt::GameLoop>(std::move(images), enable_audio != 0);
        game->board().video().set_external_3d(true);
        return 1;
    } catch (const std::exception &ex) {
        error_message = ex.what();
        return 0;
    } catch (...) {
        error_message = "Error desconocido al cargar el cartucho";
        return 0;
    }
}

const char *daytona_error() { return error_message.c_str(); }
void daytona_close() { game.reset(); drive = rt::DriveBoard{}; audio_samples.clear(); audio_frames = 0; }
int daytona_ready() { return game != nullptr; }
// Match the native gamepad frontend: directional force on the large motor,
// uncentring on the small motor. Centring is exposed separately; resistance
// remains silent because it has no positional force in the board model.
// Only the actual game's drive-board commands set these levels.
float daytona_rumble_strong() { return game ? std::fabs(drive.force()) : 0.0f; }
float daytona_rumble_weak() { return game ? drive.level(rt::DriveBoard::Effect::Uncentre) : 0.0f; }
float daytona_rumble_centring() {
    return game ? webhaptics::centring(drive, game->board().io().inputs.steer) : 0.0f;
}
uintptr_t daytona_vertices_ptr() { return reinterpret_cast<uintptr_t>(gpu_frame.verts_.data()); }
int daytona_vertices_count() { return int(gpu_frame.verts_.size()); }
uintptr_t daytona_batches_ptr() { return reinterpret_cast<uintptr_t>(gpu_frame.batches_.data()); }
int daytona_batches_count() { return int(gpu_frame.batches_.size()); }
uintptr_t daytona_background_ptr() { return game ? reinterpret_cast<uintptr_t>(game->board().video().background_layer().data()) : 0; }
uintptr_t daytona_foreground_ptr() { return game ? reinterpret_cast<uintptr_t>(game->board().video().foreground_layer().data()) : 0; }
uintptr_t daytona_tex0_ptr() { return game ? reinterpret_cast<uintptr_t>(game->board().video().gpu_mem().tex0) : 0; }
uintptr_t daytona_tex1_ptr() { return game ? reinterpret_cast<uintptr_t>(game->board().video().gpu_mem().tex1) : 0; }
double daytona_texture_generation() { return game ? double(game->board().video().gpu_mem().tex_generation) : 0; }
uintptr_t daytona_luma_ptr() { return game ? reinterpret_cast<uintptr_t>(game->board().video().gpu_mem().lumaram) : 0; }
uintptr_t daytona_xlat_ptr() { return reinterpret_cast<uintptr_t>(gpu_frame.xlat_table_.data()); }
int daytona_width() { return game ? game->screen_width() : 496; }
int daytona_height() { return rt::GameLoop::kHeight; }
// Geometry uses the original vertical field of view; extra columns expose
// more of the world. WebGPU rasterizes these coordinates at window resolution.
void daytona_set_display(int enhanced, int width, int height) {
    if (!game || width <= 0 || height <= 0) return;
    game->set_aspect(enhanced ? double(width) / double(height) : 0.0);
    game->set_stretch_backdrop(enhanced != 0);
    game->set_hud_edges(enhanced != 0);
    rt::GameLoop::set_draw_distance(enhanced ? draw_distance : 0);
    render_scale = enhanced ? double(height) / rt::Video::H : 1.0;
}
void daytona_set_draw_distance(int level) {
    draw_distance = std::clamp(level, 0, 2);
    rt::GameLoop::set_draw_distance(draw_distance);
}
int daytona_draw_distance() { return rt::Enhance::draw_distance; }
// Pointer to ABGR bytes in native little-endian memory (BGRA byte order).
uintptr_t daytona_frame_ptr() {
    if (!game || game->screen().empty()) return 0;
    return reinterpret_cast<uintptr_t>(game->screen().data());
}
int daytona_audio_frames() { return audio_frames; }
uintptr_t daytona_audio_ptr() { return audio_samples.empty() ? 0 : reinterpret_cast<uintptr_t>(audio_samples.data()); }
uint32_t daytona_total_frames() { return game ? uint32_t(game->frames()) : 0; }
uintptr_t daytona_eeprom_ptr() {
    return game ? reinterpret_cast<uintptr_t>(game->board().io().eeprom.data()) : 0;
}
int daytona_eeprom_size() { return game ? int(game->board().io().eeprom.size()) : 0; }
uintptr_t daytona_backup_ptr() {
    return game ? reinterpret_cast<uintptr_t>(game->board().backup_ram().data()) : 0;
}
int daytona_backup_size() { return game ? int(game->board().backup_ram().size()) : 0; }
int daytona_eeprom_dirty() {
    if (!game) return 0;
    const int changed = game->board().io().eeprom_dirty ? 1 : 0;
    game->board().io().eeprom_dirty = false;
    return changed;
}

// steer -100..100, accel/brake 0..100; buttons bitfield:
// 0 coin, 1 start, 2 test, 3 service, 4..7 view selection.
int daytona_step(int steer, int accel, int brake, int gear, unsigned buttons) {
    error_message.clear();
    if (!game) { error_message = "No se ha cargado el juego"; return 0; }
    rt::Inputs in;
    const int steer_adc = 0x80 + (std::clamp(steer, -100, 100) * 0x60) / 100;
    in.steer = uint8_t(steer_adc);
    in.accel = uint8_t(0x20 + std::clamp(accel, 0, 100) * 0xc0 / 100);
    in.brake = uint8_t(0x20 + std::clamp(brake, 0, 100) * 0xc0 / 100);
    const int g = std::clamp(gear, 1, 4);
    in.in1 = uint8_t((in.in1 & ~0x70) | (gear_codes[g] << 4));
    if (buttons & (1u << 0)) in.in0 &= uint8_t(~0x01); // coin
    if (buttons & (1u << 1)) in.in0 &= uint8_t(~0x10); // start
    if (buttons & (1u << 2)) in.in0 &= uint8_t(~0x04); // test
    if (buttons & (1u << 3)) in.in0 &= uint8_t(~0x08); // service
    if (buttons & (1u << 4)) in.in0 &= uint8_t(~0x20); // camera 1
    if (buttons & (1u << 5)) in.in0 &= uint8_t(~0x40); // camera 2
    if (buttons & (1u << 6)) in.in0 &= uint8_t(~0x80); // camera 3
    if (buttons & (1u << 7)) in.in1 &= uint8_t(~0x01); // camera 4
    try {
        game->run_frame(in);
        auto &commands = game->board().io().drive_commands;
        for (uint8_t command : commands) drive.command(command);
        commands.clear();
        gpu_frame.update(game->board().video(), render_scale);
        update_audio();
        return 1;
    } catch (const std::exception &ex) {
        error_message = ex.what();
    } catch (...) {
        error_message = "Fallo desconocido al ejecutar un fotograma";
    }
    game.reset();
    return 0;
}
} // extern C
