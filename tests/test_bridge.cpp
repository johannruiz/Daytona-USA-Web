#include <cassert>
#include <cstdint>
extern "C" {
int daytona_load(const char*,int);
void daytona_close();
int daytona_ready();
int daytona_width();
int daytona_height();
uintptr_t daytona_frame_ptr();
int daytona_step(int,int,int,int,unsigned);
int daytona_audio_frames();
uintptr_t daytona_audio_ptr();
uint32_t daytona_total_frames();
uintptr_t daytona_eeprom_ptr();
int daytona_eeprom_size();
uintptr_t daytona_backup_ptr();
int daytona_backup_size();
int daytona_eeprom_dirty();
}
int main(){
 assert(!daytona_load("bad",1));
 assert(daytona_load("test",1));
 assert(daytona_ready());
 assert(daytona_width()==496 && daytona_height()==384);
 assert(daytona_frame_ptr());
 assert(daytona_step(-100,100,0,4,1|2|16));
 assert(daytona_total_frames()==1);
 assert(daytona_audio_frames()>0);
 assert(daytona_audio_ptr());
 assert(daytona_eeprom_ptr() && daytona_eeprom_size()==128);
 assert(daytona_backup_ptr() && daytona_backup_size()==0x4000);
 assert(!daytona_eeprom_dirty());
 daytona_close();
 assert(!daytona_ready());
}
