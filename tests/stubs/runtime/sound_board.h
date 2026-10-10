#pragma once
#include <vector>
namespace snd {
class SoundBoard {
public:
    std::vector<float> take_fm(){return std::vector<float>(2000,.01f);}
    std::vector<float> take_pcm(){return std::vector<float>(1800,.02f);}
};
}
