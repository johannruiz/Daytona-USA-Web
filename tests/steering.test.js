import test from 'node:test';
import assert from 'node:assert/strict';
import {gamepadSteering} from '../web/steering.js';

test('default sensitivity keeps the established softened half-stick response and dead zone',()=>{
  assert.equal(gamepadSteering(0.5),29);
  assert.equal(gamepadSteering(-0.5),-29);
  for(const axis of [-0.08,-0.04,0,0.04,0.08])assert.equal(gamepadSteering(axis)+0,0);
});
test('sensitivity changes intermediate steering while preserving symmetry and full lock',()=>{
  assert.ok(gamepadSteering(0.5,0.5)<gamepadSteering(0.5,1));
  assert.ok(gamepadSteering(0.5,1.5)>gamepadSteering(0.5,1));
  for(const sensitivity of [0.25,0.5,1,1.5,1.75]){
    assert.equal(gamepadSteering(1,sensitivity),100);
    assert.equal(gamepadSteering(-1,sensitivity),-100);
    let previous=0;
    for(let step=0;step<=100;step++){
      const steering=gamepadSteering(step/100,sensitivity);
      assert.ok(steering>=previous && steering<=100);
      assert.equal(gamepadSteering(-step/100,sensitivity)+0,-steering+0);previous=steering;
    }
  }
});
test('invalid and out-of-range axes cannot exceed the steering range',()=>{
  assert.equal(gamepadSteering(NaN),0);assert.equal(gamepadSteering(Infinity),0);
  assert.equal(gamepadSteering(2),100);assert.equal(gamepadSteering(-2),-100);
});
