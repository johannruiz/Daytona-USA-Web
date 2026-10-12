import test from 'node:test';
import assert from 'node:assert/strict';
import {newWheelProfile,readWheel,wheelSteering,wheelPedal,bindingPressed,rawInput,loadWheelProfiles,saveWheelProfiles,
  WHEEL_STORAGE_ID,sanitizeProfile,snapshotDevices,detectBinding} from '../web/wheel.js';

const device=(id,index,axes=[],count=16)=>({id,index,connected:true,axes,buttons:Array.from({length:count},()=>({pressed:false,value:0}))});
const binding=(pad,type,index,extra={})=>({deviceId:pad.id,deviceIndex:pad.index,type,index,...extra});
function setup(){
  const wheel=device('Unmapped racing wheel',0,[0,1,-1]),pedals=device('Separate USB pedals',2,[1,-1]);
  const profile=newWheelProfile(wheel.id,wheel.index);profile.enabled=true;
  Object.assign(profile.steering,{binding:binding(wheel,'axis',0),center:0,left:-1,right:1});
  Object.assign(profile.accel,{binding:binding(pedals,'axis',0),rest:1,full:-1});
  Object.assign(profile.brake,{binding:binding(pedals,'axis',1),rest:-1,full:1});
  return {wheel,pedals,profile,pads:[wheel,pedals]};
}
test('wheel calibration handles asymmetrical travel and reversed axes with full steering',()=>{
  const {profile}=setup();
  Object.assign(profile.steering,{left:-0.8,center:0.2,right:0.6});
  assert.equal(wheelSteering(profile.steering,-0.8),-100);
  assert.equal(wheelSteering(profile.steering,0.2),0);
  assert.equal(wheelSteering(profile.steering,0.6),100);
  Object.assign(profile.steering,{left:1,center:0,right:-1});
  assert.equal(wheelSteering(profile.steering,1),-100);
  assert.equal(wheelSteering(profile.steering,-1),100);
  profile.steering.invert=true;assert.equal(wheelSteering(profile.steering,1),100);
});
test('separate and reversed pedals are calibrated independently; absent inputs are neutral',()=>{
  const {wheel,pedals,profile,pads}=setup();
  assert.equal(readWheel(profile,pads).accel,0);assert.equal(readWheel(profile,pads).brake,0);
  pedals.axes=[-1,1];let value=readWheel(profile,pads);
  assert.equal(value.accel,100);assert.equal(value.brake,100);
  value=readWheel(profile,[wheel]);assert.equal(value.accel,0);assert.equal(value.brake,0);
  value=readWheel(profile,[pedals]);assert.equal(value.active,false);assert.equal(value.accel,0);assert.equal(value.steer,0);
  profile.steering.center=null;assert.equal(readWheel(profile,pads).active,false);
});
test('combined pedals can share one axis without activating the opposite pedal',()=>{
  const {wheel,profile}=setup();
  Object.assign(profile.accel,{binding:binding(wheel,'axis',1),rest:0,full:-1});
  Object.assign(profile.brake,{binding:binding(wheel,'axis',1),rest:0,full:1});
  wheel.axes[1]=-1;let value=readWheel(profile,[wheel]);assert.equal(value.accel,100);assert.equal(value.brake,0);
  wheel.axes[1]=1;value=readWheel(profile,[wheel]);assert.equal(value.accel,0);assert.equal(value.brake,100);
  wheel.axes[1]=0;value=readWheel(profile,[wheel]);assert.equal(value.accel,0);assert.equal(value.brake,0);
});
test('analog buttons work as pedals and the wheel response remains linear by default',()=>{
  const {wheel,profile}=setup();
  profile.accel={binding:binding(wheel,'button',7),rest:0,full:1,deadzone:0.02};
  wheel.buttons[7].value=0.5;
  assert.equal(wheelPedal(profile.accel,0.5),49);
  assert.equal(wheelSteering(profile.steering,0.5),49);
  profile.steering.sensitivity=0.5;assert.ok(wheelSteering(profile.steering,0.5)<49);
  assert.equal(wheelSteering(profile.steering,1),100);
});
test('button and hat bindings, gear positions and single-press paddle shifts are supported',()=>{
  const {wheel,profile,pads}=setup(),edges={armed:false,previous:new Set()};
  profile.buttons.shiftUp=binding(wheel,'button',5);profile.buttons.gear3=binding(wheel,'button',2);
  profile.buttons.view2=binding(wheel,'axis-button',2,{neutral:1,target:-0.714});
  readWheel(profile,pads,edges);
  wheel.buttons[5]={pressed:true,value:1};assert.equal(readWheel(profile,pads,edges).shift,1);
  assert.equal(readWheel(profile,pads,edges).shift,0);
  wheel.buttons[2]={pressed:true,value:1};assert.equal(readWheel(profile,pads,edges).gear,3);
  wheel.axes[2]=-0.72;assert.equal(readWheel(profile,pads,edges).buttons,1<<5);
  wheel.axes[2]=-0.428;assert.equal(bindingPressed(profile.buttons.view2,pads),false);
  readWheel(profile,[],edges);assert.equal(readWheel(profile,pads,edges).shift,0,'Held paddles must not shift on reconnect');
});
test('device indices can change on reconnect; ambiguous duplicate IDs do not guess an input',()=>{
  const {wheel,profile}=setup();const source=profile.steering.binding;
  assert.equal(rawInput(source,[{...wheel,index:7,axes:[0.75]}]),0.75);
  assert.equal(rawInput(source,[{...wheel,index:6},{...wheel,index:7}]),null);
  assert.equal(rawInput(source,[{...wheel,index:0,axes:[-0.5]},{...wheel,index:7}]),-0.5);
});
test('legacy hat switches retain their out-of-range neutral value without activating at rest',()=>{
  const pad=device('Legacy wheel hat',0,[1.2857]);
  const source=binding(pad,'axis-button',0,{neutral:1.2857,target:1});
  assert.equal(bindingPressed(source,[pad]),false);
  pad.axes[0]=1;assert.equal(bindingPressed(source,[pad]),true);
  pad.axes[0]=0.714;assert.equal(bindingPressed(source,[pad]),false);
});
test('digital assignments respect a device pressed flag even with a low analogue button value',()=>{
  const pad=device('Driver threshold controller',0,[]),baseline=snapshotDevices([pad]);
  pad.buttons[2]={pressed:true,value:0.1};
  const source=detectBinding(baseline,[pad],'start');
  assert.equal(source.type,'button');assert.equal(source.index,2);
  assert.equal(bindingPressed(source,[pad]),true);
});
test('learning finds steering axes, USB pedal inputs and hat directions without assuming a mapping',()=>{
  const {wheel,pedals,pads}=setup(),baseline=snapshotDevices(pads);
  wheel.axes[0]=0.3;assert.equal(detectBinding(baseline,pads,'steering').index,0);
  wheel.axes[0]=0;pedals.axes[0]=-1;
  assert.equal(detectBinding(baseline,pads,'accel').deviceId,pedals.id);
  pedals.axes[0]=1;wheel.axes[2]=-0.714;
  assert.equal(detectBinding(baseline,pads,'view1').type,'axis-button');
  wheel.axes[2]=-1;wheel.buttons[3]={pressed:true,value:1};
  assert.equal(detectBinding(baseline,pads,'gear4').type,'button');
});
test('profiles persist per device; malformed calibration, bindings and inaccessible storage remain safe',()=>{
  const {profile}=setup();let value;
  const storage={getItem:()=>value,setItem(key,data){assert.equal(key,WHEEL_STORAGE_ID);value=data;}};
  saveWheelProfiles(storage,{selectedId:profile.deviceId,profiles:[profile]});
  assert.deepEqual(loadWheelProfiles(storage).profiles[0],profile);
  assert.deepEqual(loadWheelProfiles({getItem(){throw Error('denied');}}),{selectedId:'',profiles:[]});
  const broken=sanitizeProfile({...profile,steering:{binding:{deviceId:profile.deviceId,type:'axis',index:-1},center:'0',left:1,right:1}});
  assert.equal(readWheel(broken,[]).active,false);
  assert.doesNotThrow(()=>saveWheelProfiles({setItem(){throw Error('denied');}},{profiles:[]}));
});
