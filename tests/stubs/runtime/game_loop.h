#pragma once
#include "runtime/sound_board.h"
#include <array>
#include <cstdint>
#include <vector>
#include <memory>
namespace rt {
struct Inputs { uint8_t steer=128,accel=32,brake=32,in0=255,in1=143,in2=255; };
class M2Board {
public:
 struct Images{};
 struct Io { std::array<uint8_t,128> eeprom{}; bool eeprom_dirty=false;};
 Io& io(){return io_;}
 std::vector<uint8_t>& backup_ram(){return backup_;}
private:
 Io io_;
 std::vector<uint8_t> backup_=std::vector<uint8_t>(0x4000);
};
class GameLoop {
public:
 static constexpr double kFrameHz=16000000.0/(656.0*424.0);
 static constexpr int kHeight=384;
 GameLoop(M2Board::Images,bool s):has_sound(s){}
 void run_frame(const Inputs& in){last_input=in;++frame_count;}
 snd::SoundBoard *sound(){return has_sound?&sound_:nullptr;}
 unsigned long long frames() const{return frame_count;}
 int screen_width() const{return 496;}
 std::vector<uint32_t>& screen(){return screen_;}
 M2Board& board(){return board_;}
 Inputs last_input{};
private:
 bool has_sound;
 unsigned long long frame_count=0;
 snd::SoundBoard sound_;
 std::vector<uint32_t> screen_=std::vector<uint32_t>(496*384,0xff112233);
 M2Board board_;
};
}
