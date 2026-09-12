import { afterAll } from 'vitest';

const liveIntervals = new Set<ReturnType<typeof setInterval>>();
const nativeSetInterval = globalThis.setInterval;
const nativeClearInterval = globalThis.clearInterval;

globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
  const intervalId = nativeSetInterval(...args);
  liveIntervals.add(intervalId);
  return intervalId;
}) as typeof setInterval;

globalThis.clearInterval = ((intervalId?: Parameters<typeof clearInterval>[0]) => {
  liveIntervals.delete(intervalId as ReturnType<typeof setInterval>);
  return nativeClearInterval(intervalId);
}) as typeof clearInterval;

afterAll(() => {
  for (const intervalId of liveIntervals) nativeClearInterval(intervalId);
  liveIntervals.clear();
});
