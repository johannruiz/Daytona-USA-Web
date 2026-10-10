// BSD-3-Clause. Polygon projection/order adapted from upstream gpu_renderer.cpp.
#include "daytona_gpu.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <numeric>
namespace webgpu {
inline uint16_t le16(const uint8_t *p, uint32_t i) { return uint16_t(p[i*2] | p[i*2+1]<<8); }
Frame::Frame() {
    for (int i=0;i<256;++i) gamma_[i]=uint8_t(std::max((double(i)-64.0)*255.0/191.0,0.0));
}
void Frame::update(const rt::Video &video, double scale) {
    build(video,video.width(),rt::Video::H,scale);
    const auto &mem=video.gpu_mem();
    xlat_table_.resize(0x6000);
    if(mem.colorxlat) for(uint32_t i=0;i<0x6000;i++) xlat_table_[i]=gamma_[le16(mem.colorxlat,i)&255];
}
void Frame::build(const rt::Video &video, int w, int h, double scale) {
    verts_.clear();
    batches_.clear();
    const std::vector<rt::GeoPoly> &polys = video.gpu_polys();
    const rt::VideoMem &mem = video.gpu_mem();
    const int windows = video.gpu_windows();
    // widescreen: the screen is `margin` wider on each side; x shifts by it
    const int margin = (w - rt::Video::W) / 2;
    const int crtc_x = video.crtc_x() + margin, crtc_y = video.crtc_y(), render_x = video.render_x() + margin,
              render_y = video.render_y();
    // HUD at the edges: the condition panel's own quads (its z, inside its box) move
    const int hud_dx = video.gpu_hud_shift();
    const float *hud_box = video.raster().hud_box();
    const uint16_t hud_z = video.raster().hud_z();
    if (polys.empty() || !mem.palram || !mem.colorxlat) return;
    // internal resolution: the mip level the rasterizer picks from z, less
    // log2(scale) (its levels are 128 units of fast_log2)
    const int lod_bias = int(std::lround(128.0 * std::log2(double(scale))));

    // Raster::render: windows from the last down to 0, low z first, newest first within z.
    order_.resize(polys.size());
    std::iota(order_.begin(), order_.end(), size_t(0));
    std::sort(order_.begin(), order_.end(), [&](size_t a, size_t b) {
        if (polys[a].window != polys[b].window) return polys[a].window > polys[b].window;
        if (polys[a].z != polys[b].z) return polys[a].z < polys[b].z;
        return a > b;
    });
    const float depth_step = 1.0f / float(order_.size() + 2);
    uint32_t drawn = 0;
    for (size_t i : order_) {
        const rt::GeoPoly &poly = polys[i];
        if (poly.window > windows || poly.num_vertices < 3) continue;
        const int renderer = (poly.texheader[0] >> 13) & 3;
        if (renderer == 1) continue; // translucent solid: the rasterizer draws nothing

        // HUD overlay quad? (Raster::render_one's test, on the projected outline)
        int dx = 0;
        if (hud_dx && poly.z == hud_z) {
            float bx0 = 1e9f, bx1 = -1e9f, by0 = 1e9f, by1 = -1e9f;
            for (int k = 0; k < poly.num_vertices; k++) {
                const rt::GeoVertex &g0 = poly.v[k];
                const float z = g0.p[0] + std::numeric_limits<float>::min();
                const float px = float(crtc_x + poly.center[0]) + g0.x / z - float(margin);
                const float py = float((384 - poly.center[1]) + crtc_y) - g0.y / z;
                bx0 = std::min(bx0, px), bx1 = std::max(bx1, px), by0 = std::min(by0, py), by1 = std::max(by1, py);
            }
            constexpr float kTol = 1.5f;
            if (bx0 >= hud_box[0] - kTol && bx1 <= hud_box[1] + kTol && by0 >= hud_box[2] - kTol && by1 <= hud_box[3] + kTol)
                dx = hud_dx;
        }
        // clip rectangle (Raster::render_one), in the renderer's offsets, within the screen;
        // a viewport spanning the screen extends into the widescreen margins
        const int wide = margin && poly.viewport[0] <= 0 && poly.viewport[2] >= 495 ? margin : 0;
        const int x0 = std::max(poly.viewport[0] - wide + render_x + dx, 0),
                  x1 = std::min(poly.viewport[2] + wide + render_x + dx, w - 1);
        const int y0 = std::max((384 - poly.viewport[3]) + render_y, 0), y1 = std::min((384 - poly.viewport[1]) + render_y, h - 1);
        if (x0 > x1 || y0 > y1) continue;
        const Clip clip{x0, y0, x1 - x0 + 1, y1 - y0 + 1};
        if (batches_.empty() || std::memcmp(&batches_.back().clip, &clip, sizeof clip) != 0)
            batches_.push_back({uint32_t(verts_.size()), 0, clip});

        // colour: the solid renderer's (palette entry, luma translation, gamma)
        const uint32_t colorbase = (poly.texheader[3] >> 6) & 0x3ff;
        const uint32_t luma = poly.luma >> 2;
        const uint32_t color = le16(mem.palram, colorbase + 0x1000);
        const float r = gamma_[le16(mem.colorxlat, 0x0000 / 2 + (((color >> 0) & 0x1f) << 8) + luma) & 0xff] / 255.0f;
        const float g = gamma_[le16(mem.colorxlat, 0x4000 / 2 + (((color >> 5) & 0x1f) << 8) + luma) & 0xff] / 255.0f;
        const float b = gamma_[le16(mem.colorxlat, 0x8000 / 2 + (((color >> 10) & 0x1f) << 8) + luma) & 0xff] / 255.0f;
        const float depth = float(++drawn) * depth_step;

        // texture state, decoded as render_one (m2.hlsl PolyIn)
        const uint32_t th0 = poly.texheader[0], th1 = poly.texheader[1], th2 = poly.texheader[2];
        const uint32_t mirx = (th0 >> 8) & 1, miry = (th0 >> 9) & 1;
        const uint32_t wlog = th0 & 7, hlog = (th0 >> 3) & 7;
        // the rasterizer's 30 - countl_zero(min(width, height)): log2(min) - 1, width = 32 << wlog
        const uint32_t max_level = 4 + std::min(wlog, hlog);
        uint32_t info[4], more[2];
        info[0] = uint32_t(renderer) | ((th0 >> 15) & 1) << 2 | (((th0 >> 6) & 1) & ~mirx) << 3 |
                  (((th0 >> 7) & 1) & ~miry) << 4 | mirx << 5 | miry << 6 | ((th0 >> 12) & 1) << 7 |
                  ((th0 >> 10) & 3) << 8 | ((th2 >> 12) & 1) << 10 | max_level << 12 | wlog << 17 | hlog << 20;
        info[1] = (32u * (th2 & 0x3f)) | (32u * ((th2 >> 6) & 0x1f)) << 16;
        info[2] = (((th2 >> 13) & 1) * 128) | (((th2 >> 14) & 3) * 128) << 16;
        info[3] = ((th1 & 0xff) << 7) | uint32_t(poly.luma) << 16;
        more[0] = uint32_t(poly.texlod + lod_bias);
        more[1] = le16(mem.palram, colorbase + 0x1000) & 0x7fff;

        // model2_3d_project, then a fan from vertex 0 (the polygon is convex)
        Vertex v[8];
        for (int k = 0; k < poly.num_vertices; k++) {
            const rt::GeoVertex &g0 = poly.v[k];
            const float z = g0.p[0] + std::numeric_limits<float>::min();
            const float ooz = 1.0f / z; // render_one, textured: p[0] = 1/z, p[1..2] scaled by it / 8
            v[k] = {float(crtc_x + dx + poly.center[0]) + g0.x / z, float((384 - poly.center[1]) + crtc_y) - g0.y / z, depth,
                    ooz, g0.p[1] * ooz * (1.0f / 8.0f), g0.p[2] * ooz * (1.0f / 8.0f),
                    r, g, b, 1.0f, {info[0], info[1], info[2], info[3]}, {more[0], more[1]}};
        }
        for (int k = 1; k + 1 < poly.num_vertices; k++) {
            verts_.push_back(v[0]);
            verts_.push_back(v[k]);
            verts_.push_back(v[k + 1]);
        }
        batches_.back().count = uint32_t(verts_.size()) - batches_.back().first;
    }
}

}
