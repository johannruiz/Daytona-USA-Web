export const WHEEL_STORAGE_ID='daytona-web-wheel-profiles-v1';
export const WHEEL_ACTIONS=Object.freeze({gear1:'Gear 1',gear2:'Gear 2',gear3:'Gear 3',gear4:'Gear 4',shiftDown:'Shift down',shiftUp:'Shift up',view1:'Camera 1',view2:'Camera 2',view3:'Camera 3',view4:'Camera 4',coin:'Insert coin',start:'Start'});
const finite=value=>typeof value==='number' && Number.isFinite(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const point=value=>finite(value) && Math.abs(value)<=1?value:null;
export function sanitizeBinding(binding) {
  if(!binding || typeof binding.deviceId!=='string' || !binding.deviceId || binding.deviceId.length>512 ||
     !Number.isInteger(binding.deviceIndex) || binding.deviceIndex<0 || binding.deviceIndex>255 ||
     !Number.isInteger(binding.index) || binding.index<0 || binding.index>255 || !['axis','button','axis-button'].includes(binding.type))return null;
  const result={deviceId:binding.deviceId,deviceIndex:binding.deviceIndex,index:binding.index,type:binding.type};
  if(binding.type==='axis-button'){
    if(!finite(binding.target) || !finite(binding.neutral) || Math.abs(binding.target-binding.neutral)<0.2)return null;
    result.target=binding.target;result.neutral=binding.neutral;
  }
  return result;
}
export function newWheelProfile(deviceId='',deviceIndex=0) {
  return {deviceId,deviceIndex,enabled:false,
    steering:{binding:null,center:null,left:null,right:null,invert:false,deadzone:0.02,sensitivity:1},
    accel:{binding:null,rest:null,full:null,deadzone:0.02},
    brake:{binding:null,rest:null,full:null,deadzone:0.02},
    buttons:Object.fromEntries(Object.keys(WHEEL_ACTIONS).map(key=>[key,null]))};
}
export function sanitizeProfile(saved) {
  if(!saved || typeof saved.deviceId!=='string' || !saved.deviceId || saved.deviceId.length>512)return null;
  const profile=newWheelProfile(saved.deviceId,Number.isInteger(saved.deviceIndex)?clamp(saved.deviceIndex,0,255):0);
  profile.enabled=saved.enabled===true;
  for(const role of ['steering','accel','brake']){
    const source=saved[role] || {},destination=profile[role];
    destination.binding=sanitizeBinding(source.binding);
    if(destination.binding?.type==='axis-button' || (role==='steering' && destination.binding?.type!=='axis'))destination.binding=null;
    for(const key of role==='steering'?['center','left','right']:['rest','full'])destination[key]=point(source[key]);
    if(finite(source.deadzone))destination.deadzone=clamp(source.deadzone,0,0.15);
  }
  profile.steering.invert=saved.steering?.invert===true;
  if(finite(saved.steering?.sensitivity))profile.steering.sensitivity=clamp(saved.steering.sensitivity,0.25,1.75);
  for(const action of Object.keys(WHEEL_ACTIONS)){
    const binding=sanitizeBinding(saved.buttons?.[action]);
    profile.buttons[action]=binding?.type==='axis'?null:binding;
  }
  return profile;
}
export function loadWheelProfiles(storage) {
  let saved;
  try {saved=JSON.parse(storage.getItem(WHEEL_STORAGE_ID));}catch{}
  const profiles=Array.isArray(saved?.profiles)?saved.profiles.slice(0,24).map(sanitizeProfile).filter(Boolean):[];
  return {selectedId:profiles.some(profile=>profile.deviceId===saved?.selectedId)?saved.selectedId:'',profiles};
}
export function saveWheelProfiles(storage,state) {
  try {storage.setItem(WHEEL_STORAGE_ID,JSON.stringify(state));}catch{}
}
export function bindingDevice(binding,pads) {
  if(!binding)return null;
  const matches=pads.filter(pad=>pad?.connected && pad.id===binding.deviceId);
  return matches.find(pad=>pad.index===binding.deviceIndex) || (matches.length===1?matches[0]:null);
}
export function rawInput(binding,pads) {
  const pad=bindingDevice(binding,pads);
  if(!pad)return null;
  const value=binding.type==='button'?(pad.buttons[binding.index]?.value ?? (pad.buttons[binding.index]?.pressed?1:0)):pad.axes[binding.index];
  if(binding.type==='button' && !pad.buttons[binding.index])return null;
  // Some legacy hat-switch reports use an out-of-range neutral value. Keep
  // these digital-axis samples intact; analogue driving inputs stay bounded.
  return finite(value)?binding.type==='axis-button'?value:clamp(value,binding.type==='button'?0:-1,1):null;
}
export function steeringCalibrated(steering) {
  return !!steering?.binding && [steering.center,steering.left,steering.right].every(finite) &&
    Math.abs(steering.left-steering.center)>=0.05 && Math.abs(steering.right-steering.center)>=0.05 &&
    (steering.left-steering.center)*(steering.right-steering.center)<0;
}
export function pedalCalibrated(pedal) {
  return !!pedal?.binding && finite(pedal.rest) && finite(pedal.full) && Math.abs(pedal.full-pedal.rest)>=0.05;
}
export function wheelSteering(steering,value) {
  if(!steeringCalibrated(steering) || !finite(value))return 0;
  const delta=value-steering.center,right=steering.right-steering.center,left=steering.left-steering.center;
  const normalized=clamp(delta*right>=0?delta/right:-delta/left,-1,1);
  const travel=Math.max(0,(Math.abs(normalized)-steering.deadzone)/(1-steering.deadzone));
  return Math.round(Math.sign(normalized)*(steering.invert?-1:1)*Math.pow(travel,1/steering.sensitivity)*100);
}
export function wheelPedal(pedal,value) {
  if(!pedalCalibrated(pedal) || !finite(value))return 0;
  const travel=clamp((value-pedal.rest)/(pedal.full-pedal.rest),0,1);
  return Math.round(Math.max(0,(travel-pedal.deadzone)/(1-pedal.deadzone))*100);
}
export function bindingPressed(binding,pads) {
  const value=rawInput(binding,pads);
  if(value===null)return false;
  if(binding.type==='button')return !!bindingDevice(binding,pads)?.buttons[binding.index]?.pressed || value>=0.5;
  return binding.type==='axis-button' && Math.abs(value-binding.target)<=0.1 && Math.abs(value-binding.neutral)>0.15;
}
export function readWheel(profile,pads,edges={armed:false,previous:new Set()}) {
  const result={active:false,steer:0,accel:0,brake:0,buttons:0,gear:null,shift:0};
  if(!profile?.enabled || !steeringCalibrated(profile.steering) || rawInput(profile.steering.binding,pads)===null){
    edges.armed=false;edges.previous=new Set();return result;
  }
  result.active=true;result.steer=wheelSteering(profile.steering,rawInput(profile.steering.binding,pads));
  result.accel=wheelPedal(profile.accel,rawInput(profile.accel.binding,pads));
  result.brake=wheelPedal(profile.brake,rawInput(profile.brake.binding,pads));
  const pressed=new Set(Object.keys(WHEEL_ACTIONS).filter(action=>bindingPressed(profile.buttons[action],pads)));
  for(let gear=1;gear<=4;gear++)if(pressed.has(`gear${gear}`))result.gear=gear;
  if(edges.armed){
    if(pressed.has('shiftUp') && !edges.previous.has('shiftUp'))result.shift++;
    if(pressed.has('shiftDown') && !edges.previous.has('shiftDown'))result.shift--;
  }
  edges.armed=true;edges.previous=pressed;
  if(pressed.has('coin'))result.buttons|=1;
  if(pressed.has('start'))result.buttons|=2;
  for(let view=1;view<=4;view++)if(pressed.has(`view${view}`))result.buttons|=1<<(view+3);
  return result;
}
export function snapshotDevices(pads) {
  return pads.filter(pad=>pad?.connected).map(pad=>({id:pad.id,index:pad.index,
    axes:Array.from(pad.axes,value=>finite(value)?value:0),buttons:Array.from(pad.buttons,button=>button?.value ?? (button?.pressed?1:0)),pressed:Array.from(pad.buttons,button=>!!button?.pressed || (button?.value ?? 0)>=0.5)}));
}
export function detectBinding(baseline,pads,role) {
  const candidates=[];
  for(const pad of pads.filter(pad=>pad?.connected)){
    const before=baseline.find(sample=>sample.id===pad.id && sample.index===pad.index);
    if(!before)continue;
    const make=(type,index,extra={})=>({deviceId:pad.id,deviceIndex:pad.index,type,index,...extra});
    if(role!=='steering')for(let index=0;index<pad.buttons.length;index++){
      const value=pad.buttons[index]?.value ?? (pad.buttons[index]?.pressed?1:0);
      const pressed=!!pad.buttons[index]?.pressed || value>=0.5,beforePressed=before.pressed?.[index] ?? (before.buttons[index] ?? 0)>=0.5;
      if(pressed && !beforePressed)candidates.push({score:2+value,binding:make('button',index)});
    }
    for(let index=0;index<pad.axes.length;index++){
      const value=pad.axes[index],neutral=before.axes[index];
      if(!finite(value) || !finite(neutral))continue;
      const delta=Math.abs(value-neutral);
      if(delta<0.18)continue;
      candidates.push({score:delta,binding:role in WHEEL_ACTIONS?make('axis-button',index,{target:value,neutral}):make('axis',index)});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]?.binding || null;
}
