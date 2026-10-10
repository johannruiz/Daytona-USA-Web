// BSD-3-Clause. Port of upstream src/app/gpu/m2.hlsl (Model 2 raster rules).
struct Screen { size: vec2f, pad: vec2f, origin: vec2f, unused: vec2f }
@group(0) @binding(0) var<uniform> screen: Screen;
@group(0) @binding(1) var<storage, read> texram: array<u32>;
@group(0) @binding(2) var<storage, read> lumaram: array<u32>;
@group(0) @binding(3) var<storage, read> xlat: array<u32>;
struct In {
 @location(0) pos: vec2f, @location(1) depth: f32, @location(2) oz: vec3f,
 @location(3) color: vec4f, @location(4) info: vec4u, @location(5) more: vec2u
}
struct Out {
 @builtin(position) pos: vec4f,
 @location(0) @interpolate(linear) oz: vec3f,
 @location(1) @interpolate(flat) color: vec4f,
 @location(2) @interpolate(flat) info: vec4u,
 @location(3) @interpolate(flat) more: vec2u
}
@vertex fn vs_poly(i: In) -> Out {
 var o: Out;
 o.pos=vec4f((i.pos.x-screen.pad.x)/screen.size.x*2.0-1.0,1.0-i.pos.y/screen.size.y*2.0,i.depth,1.0);
 o.oz=i.oz; o.color=i.color; o.info=i.info; o.more=i.more;
 return o;
}
const log_table=array<u32,128>(0,2,5,8,11,14,16,19,22,25,27,30,33,35,38,40,43,46,48,51,53,56,58,61,63,65,68,70,73,75,77,80,82,84,87,89,91,93,96,98,100,102,104,106,109,111,113,115,117,119,121,123,125,127,129,132,134,136,138,140,141,143,145,147,149,151,153,155,157,159,161,162,164,166,168,170,172,173,175,177,179,181,182,184,186,188,189,191,193,194,196,198,200,201,203,205,206,208,209,211,213,214,216,218,219,221,222,224,225,227,229,230,232,233,235,236,238,239,241,242,244,245,247,248,250,251,253,254);
fn fast_log2(value:f32)->i32 {
 if(value<0.0){return 0;}
 let iv=bitcast<u32>(value)>>16u;
 return ((i32(iv>>7u)-127)<<8u)|i32(log_table[iv&127u]);
}
fn to_s32(f:f32)->i32 {
 if(!(f>=-2147483648.0 && f<2147483648.0)){return bitcast<i32>(0x80000000u);}
 return i32(f);
}
fn lerp8(x:u32,y:u32,a:u32)->u32 {return (x+(((y-x)*a)>>8u))&0x00ff00ffu;}
fn get_texel(bx:u32,by:u32,x:i32,y:i32,sheet:u32)->u32 {
 var x2=i32(bx)+x; var y2=i32(by)+y;
 if(x2>=1024){x2-=1024;y2^=1024;}
 let off=u32((y2/2)*512+(x2/2));
 var t=texram[sheet*0x80000u+((off>>1u)&0x7ffffu)];
 if((off&1u)!=0u){t>>=16u;}
 if((y&1)==0){t>>=8u;}
 if((x&1)==0){t>>=4u;}
 return t&15u;
}
fn fetch_texel(info:vec4u,level:i32,uin:i32,vin:i32,trans:bool)->u32 {
 let flags=info.x; let swap=((flags>>10u)&1u)!=0u;
 var u=uin; var v=vin;
 var tw:u32; var th:u32; var tx:u32; var ty:u32; var sheet:u32;
 if(level == -1){
  tw=128u;th=128u;tx=info.z&65535u;ty=info.z>>16u;
  sheet=select(1u,0u,swap);
  let sh=1u<<((flags>>8u)&3u);u<<=sh;v<<=sh;
 }else{
  tw=(32u<<((flags>>17u)&7u))>>u32(level);
  th=(32u<<((flags>>20u)&7u))>>u32(level);
  tx=(((info.y&65535u)-2048u)>>u32(level))&2047u;
  ty=(( (info.y>>16u)-1024u)>>u32(level))&1023u;
  sheet=select(0u,1u,((level&1)!=0)!=swap);
  u>>=u32(level);v>>=u32(level);
 }
 if(((flags>>5u)&1u)!=0u && (u&i32(tw<<8u))!=0){u=~u;}
 if(((flags>>6u)&1u)!=0u && (v&i32(th<<8u))!=0){v=~v;}
 u-=128;v-=128;
 var uf=u32(u)&255u; var vf=u32(v)&255u;
 var u0=i32(u32(u>>8u)&(tw-1u));var u1=i32(u32(u0+1)&(tw-1u));
 var v0=i32(u32(v>>8u)&(th-1u));var v1=i32(u32(v0+1)&(th-1u));
 if(((flags>>3u)&1u)==0u && u1==0){
  if(uf>=128u){u0=u1;u1++;uf=0u;}else{u1=u0;u0--;uf=256u;}
 }
 if(((flags>>4u)&1u)==0u && v1==0){
  if(vf>=128u){v0=0;v1++;vf=0u;}else{v1=v0;v0--;vf=256u;}
 }
 var t00=get_texel(tx,ty,u0,v0,sheet)<<4u;
 var t01=get_texel(tx,ty,u1,v0,sheet)<<4u;
 var t10=get_texel(tx,ty,u0,v1,sheet)<<4u;
 var t11=get_texel(tx,ty,u1,v1,sheet)<<4u;
 if(trans){
  if(t00!=240u){t00|=0x00800000u;}if(t01!=240u){t01|=0x00800000u;}
  if(t10!=240u){t10|=0x00800000u;}if(t11!=240u){t11|=0x00800000u;}
  if(t00==240u){t00=t01&255u;}if(t01==240u){t01=t00&255u;}
  if(t10==240u){t10=t11&255u;}if(t11==240u){t11=t10&255u;}
 }
 var t0=lerp8(t00,t01,uf);var t1=lerp8(t10,t11,uf);
 if(trans){if(t0==240u){t0=t1&255u;}if(t1==240u){t1=t0&255u;}}
 return lerp8(t0,t1,vf);
}
@fragment fn ps_poly(i:Out)->@location(0) vec4f {
 let flags=i.info.x;
 if(((flags>>2u)&1u)!=0u){let p=vec2u(i.pos.xy);if(((p.x^p.y)&1u)==0u){discard;}}
 let renderer=flags&3u;
 if(renderer<2u){return i.color;}
 let trans=renderer==3u;let maxlevel=i32((flags>>12u)&31u);
 let z=1.0/i.oz.x;let mml= -bitcast<i32>(i.more.x)+fast_log2(z);
 let level=clamp(mml>>7u,0,maxlevel);
 let u=to_s32(i.oz.y*z*256.0);let v=to_s32(i.oz.z*z*256.0);
 var t=fetch_texel(i.info,level,u,v,trans);
 if(mml>0 && level<maxlevel){t=lerp8(t,fetch_texel(i.info,level+1,u,v,trans),u32((mml&127)<<1u));}
 else if(((flags>>7u)&1u)!=0u && mml<0){t=lerp8(t,fetch_texel(i.info,-1,u,v,trans),u32(min((-mml)>>((flags>>8u)&3u),127)));}
 if(trans){if(t<0x00400000u){discard;}t&=255u;}
 let lb=i.info.w&65535u;let pl=i.info.w>>16u;
 let luma=min(((lumaram[lb+(t>>1u)]&255u)*pl/256u)&255u,63u);
 let c=i.more.y;
 return vec4f(f32(xlat[((c&31u)<<8u)+luma]),f32(xlat[0x2000u+(((c>>5u)&31u)<<8u)+luma]),f32(xlat[0x4000u+(((c>>10u)&31u)<<8u)+luma]),255.0)/255.0;
}
