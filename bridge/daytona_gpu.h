// BSD-3-Clause. Based on alphanu1/daytona-arcade-recomp's SDL_GPU renderer.
#pragma once
#include "runtime/video.h"
#include <cstdint>
#include <vector>

namespace webgpu {
struct Vertex {
    float x, y, depth, ooz, uoz, voz, r, g, b, a;
    uint32_t info[4], more[2];
};
struct Clip { int x, y, w, h; };
struct Batch { uint32_t first, count; Clip clip; };
static_assert(sizeof(Vertex) == 64);
static_assert(sizeof(Batch) == 24);
class Frame {
public:
    Frame();
    void build(const rt::Video &video, int w, int h, double scale = 1);
    void update(const rt::Video &video, double scale = 1);
    std::vector<Vertex> verts_;
    std::vector<Batch> batches_;
    std::vector<uint32_t> xlat_table_;
private:
    std::vector<size_t> order_;
    uint8_t gamma_[256];
};
}
