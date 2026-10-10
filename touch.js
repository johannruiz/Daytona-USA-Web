// Independent pointer IDs allow steering and pedals to be held together.
export function createTouchControls(root, {isRunning, shift, menu, settings}) {
  const pointers=new Map();
  let steeringPointer=null, steering=0, camera=0;
  const pad=root.querySelector('[data-steering]');
  const knob=root.querySelector('.steering-knob');
  function move(e){
    const box=pad.getBoundingClientRect();
    const value=Math.max(-1,Math.min(1,(e.clientX-box.left-box.width/2)/(box.width*.36)));
    steering=Math.abs(value)<.08?0:Math.round(value*100);
    knob.style.transform=`translateX(${steering*.35}px)`;
  }
  function release(e){
    const action=pointers.get(e.pointerId);pointers.delete(e.pointerId);
    if(e.pointerId===steeringPointer){steeringPointer=null;steering=0;knob.style.transform='';}
    if(action && ![...pointers.values()].includes(action))root.querySelector(`[data-action="${action}"]`)?.classList.remove('pressed');
  }
  pad.addEventListener('pointerdown',e=>{
    if(!isRunning() || steeringPointer!==null)return;
    e.preventDefault();steeringPointer=e.pointerId;pad.setPointerCapture(e.pointerId);move(e);
  });
  pad.addEventListener('pointermove',e=>{if(e.pointerId===steeringPointer)move(e);});
  for(const button of root.querySelectorAll('[data-action]')){
    button.addEventListener('pointerdown',e=>{
      if(!isRunning())return;
      e.preventDefault();button.setPointerCapture(e.pointerId);
      const action=button.dataset.action;pointers.set(e.pointerId,action);button.classList.add('pressed');
      if(action==='up')shift(1);
      if(action==='down')shift(-1);
      if(action==='camera')camera=(camera+1)%4;
    });
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(name,release);
  root.querySelector('[data-menu]').addEventListener('click',menu);
  root.querySelector('[data-settings]').addEventListener('click',settings);
  const clear=()=>{pointers.clear();steeringPointer=null;steering=0;knob.style.transform='';root.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));};
  window.addEventListener('blur',clear);
  window.addEventListener('resize',clear);
  return {clear,read(){
    const actions=new Set(pointers.values());
    let buttons=0;
    if(actions.has('coin'))buttons|=1;
    if(actions.has('start'))buttons|=2;
    if(actions.has('camera'))buttons|=1<<(4+camera);
    if(actions.has('test'))buttons|=4;
    if(actions.has('service'))buttons|=8;
    if(actions.has('previous'))buttons|=128;
    if(actions.has('next'))buttons|=32;
    if(actions.has('value'))buttons|=64;
    return {steer:steering,accel:actions.has('gas')?100:0,brake:actions.has('brake')?100:0,buttons};
  }};
}
