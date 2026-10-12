// Sensitivity reshapes the response, preserving the dead zone and full lock.
// 100% reproduces the existing softened stick response exactly.
export function gamepadSteering(axis,sensitivity=1) {
  const stick=Math.max(-1,Math.min(1,Number.isFinite(axis)?axis:0));
  const response=Math.max(0.25,Math.min(1.75,Number.isFinite(sensitivity)?sensitivity:1));
  const travel=Math.max(0,(Math.abs(stick)-0.08)/0.92);
  return Math.round(Math.sign(stick)*Math.pow(travel,1.6/response)*100);
}
