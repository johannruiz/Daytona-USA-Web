import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamepadRumble } from '../web/haptics.js';

function fixture(actuator = {}) {
  const calls=[],statuses=[];
  const pad={index:0,id:'test controller',vibrationActuator:{
    playEffect(type,params){calls.push({type,...params});return Promise.resolve('complete');},
    reset(){calls.push({reset:true});return Promise.resolve('complete');},
    ...actuator
  }};
  const rumble=createGamepadRumble(status=>statuses.push(status));
  // Keep these scheduler fixtures at fixed levels; player defaults have a
  // separate assertion below.
  rumble.setIntensity(0.45);rumble.setCentringIntensity(0.25);
  return {pad,rumble,calls,statuses};
}

test('player default profile is full vibration with subtle five-percent centring',()=>{
  const rumble=createGamepadRumble();
  assert.equal(rumble.getIntensity(),1);assert.equal(rumble.getCentringIntensity(),0.05);
});

test('silence stays silent; board force ramps, is bounded and stops immediately',()=>{
  const {pad,rumble,calls}=fixture();
  rumble.update(pad,0,0,0);assert.equal(calls.length,0);
  rumble.update(pad,1,0,10);
  assert.equal(calls[0].strongMagnitude,0.12);assert.equal(calls[0].weakMagnitude,0);
  rumble.update(pad,1,0,40);assert.equal(calls.length,1);
  rumble.update(pad,1,0,60);rumble.update(pad,1,0,110);
  assert.equal(calls[2].strongMagnitude,0.45*0.65);
  assert.equal(calls[2].duration,120);
  rumble.update(pad,0,0,111);assert.deepEqual(calls.at(-1),{reset:true});
  rumble.update(pad,0,0,160);assert.equal(calls.length,4);
});

test('uncentring drives only the weak motor; output falls with the game',()=>{
  const {pad,rumble,calls}=fixture();
  rumble.update(pad,0,1,0);rumble.update(pad,0,1,50);
  assert.equal(calls[1].strongMagnitude,0);assert.equal(calls[1].weakMagnitude,0.24);
  rumble.update(pad,0,0.1,100);
  assert.equal(calls[2].weakMagnitude,0.1*0.45*0.65);
});

test('off, pause, disconnect and controller replacement stop the old actuator',()=>{
  const {pad,rumble,calls,statuses}=fixture();
  rumble.update(pad,1,0,0);rumble.stop();assert.deepEqual(calls.at(-1),{reset:true});
  rumble.update(pad,1,0,50);rumble.setIntensity(0);
  assert.deepEqual(calls.at(-1),{reset:true});assert.equal(statuses.at(-1),'Off');
  const count=calls.length;rumble.update(pad,1,1,100);assert.equal(calls.length,count);
  rumble.setIntensity(1);rumble.update(pad,1,0,150);rumble.disconnect();
  assert.deepEqual(calls.at(-1),{reset:true});
  rumble.update(pad,1,0,200);
  rumble.update({...pad,index:1,id:'replacement'},0,0,250);
  assert.deepEqual(calls.at(-1),{reset:true});
});

test('unsupported hardware and failed requests do not break gameplay or retry endlessly',async()=>{
  const {pad,rumble,calls,statuses}=fixture({playEffect(){return Promise.reject(Error('unsupported'));}});
  rumble.update(pad,1,0,0);await Promise.resolve();await Promise.resolve();
  assert.equal(statuses.at(-1),'Unavailable on this controller');
  rumble.update(pad,1,0,100);assert.equal(calls.length,1);
  rumble.disconnect();pad.vibrationActuator.playEffect=()=>{calls.push({retry:true});return Promise.resolve();};
  rumble.update(pad,1,0,150);assert.deepEqual(calls.at(-1),{retry:true});
  rumble.update({index:2,id:'unsupported'},1,1,200);
  assert.equal(statuses.at(-1),'Unavailable on this controller');
});

test('stale rejections cannot cancel a resumed effect; missing reset has a zero fallback',async()=>{
  let reject;
  const {pad,rumble,calls}=fixture({reset:undefined,playEffect(type,params){
    calls.push(params);return new Promise((resolve,no)=>{reject=no;});
  }});
  rumble.update(pad,1,0,0);const staleReject=reject;
  rumble.stop();assert.equal(calls.at(-1).duration,0);
  rumble.update(pad,0,1,100);staleReject(Error('old request'));await Promise.resolve();
  assert.equal(calls.length,3);assert.equal(calls.at(-1).weakMagnitude,0.12);
});

test('invalid levels are silent and even maximum settings cap both motors',()=>{
  const {pad,rumble,calls}=fixture();
  rumble.setIntensity(10);assert.equal(rumble.getIntensity(),1);
  for(let now=0;now<=300;now+=50)rumble.update(pad,10,10,now);
  assert.equal(calls.at(-1).strongMagnitude,0.65);assert.equal(calls.at(-1).weakMagnitude,0.65);
  rumble.update(pad,NaN,Infinity,301);assert.deepEqual(calls.at(-1),{reset:true});
});

test('centring is a quiet separate cue, with no baseline and exclusive effect priority',()=>{
  const {pad,rumble,calls}=fixture();
  assert.equal(rumble.getCentringIntensity(),0.25);
  rumble.update(pad,0,0,0,0);assert.equal(calls.length,0);
  rumble.update(pad,0,0,50,0.4);
  assert.equal(calls.at(-1).strongMagnitude,0.4*0.25*0.45*0.65);
  assert.equal(calls.at(-1).weakMagnitude,0);
  rumble.update(pad,0,0,51,0);assert.deepEqual(calls.at(-1),{reset:true});
  rumble.update(pad,0.1,0,100,1);
  assert.equal(calls.at(-1).strongMagnitude,0.1*0.45*0.65);
  rumble.update(pad,0,0.1,150,1);
  assert.equal(calls.at(-1).strongMagnitude,0);assert.equal(calls.at(-1).weakMagnitude,0.1*0.45*0.65);
  rumble.setCentringIntensity(0);
  const count=calls.length;rumble.update(pad,0,0,200,1);assert.equal(calls.length,count);
  rumble.update(pad,0.1,0,250,1);assert.equal(calls.at(-1).strongMagnitude,0.1*0.45*0.65);
});

test('centring is capped even at maximum settings and respects the master Off control',()=>{
  const {pad,rumble,calls}=fixture();
  rumble.setIntensity(1);rumble.setCentringIntensity(1);
  for(let now=0;now<=150;now+=50)rumble.update(pad,0,0,now,1);
  assert.equal(calls.at(-1).strongMagnitude,0.15);
  rumble.update(pad,0,0,200,0.5);
  assert.equal(calls.at(-1).strongMagnitude,0.075);
  rumble.setIntensity(0);const count=calls.length;
  rumble.update(pad,0,0,250,1);assert.equal(calls.length,count);
});
