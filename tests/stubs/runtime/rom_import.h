#pragma once
#include "runtime/game_loop.h"
#include <stdexcept>
#include <string>
#include <vector>
namespace rt {
inline M2Board::Images import_rom_set(const std::string& p){if(p=="bad") throw std::runtime_error("Invalid ROM"); return {};}
inline std::vector<uint8_t> tgp_program(const M2Board::Images&){return {};}
}
