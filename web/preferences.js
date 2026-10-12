export const SETTINGS_ID='daytona-web-player-settings-v1';
export const DEFAULT_SETTINGS=Object.freeze({vibrationEnabled:true,rumble:1,centring:0.05,drawDistance:2,volume:1,joystickSensitivity:1});
export function loadSettings(storage,{mobile=false}={}) {
  let saved;
  try {saved=JSON.parse(storage.getItem(SETTINGS_ID));}catch{}
  const result={...DEFAULT_SETTINGS,drawDistance:mobile?1:2};
  if(!saved || typeof saved!=='object')return result;
  if(typeof saved.vibrationEnabled==='boolean')result.vibrationEnabled=saved.vibrationEnabled;
  for(const key of ['rumble','centring','volume']){
    if(typeof saved[key]==='number' && Number.isFinite(saved[key]))result[key]=Math.max(0,Math.min(1,saved[key]));
  }
  if([0,1,2].includes(saved.drawDistance))result.drawDistance=saved.drawDistance;
  if(typeof saved.joystickSensitivity==='number' && Number.isFinite(saved.joystickSensitivity))
    result.joystickSensitivity=Math.max(0.25,Math.min(1.75,saved.joystickSensitivity));
  return result;
}
export function saveSettings(storage,settings) {
  try {storage.setItem(SETTINGS_ID,JSON.stringify(settings));}catch{}
}
