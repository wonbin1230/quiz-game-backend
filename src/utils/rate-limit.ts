
const eventLockMap = {} as Record<string, Record<string, boolean>>

export const EventLockGet = (socketId: string, eventName: string): boolean => {
  return !!eventLockMap[socketId] && !!eventLockMap[socketId][eventName];
}

export const EventLockSetLock = (socketId: string, eventName: string): void => {
  if (!eventLockMap[socketId]) {
    eventLockMap[socketId] = {};
  }
  eventLockMap[socketId][eventName] = true;
}

export const EventLockSetUnlock = (socketId: string, eventName: string): void => {
  if (!eventLockMap[socketId]) {
    eventLockMap[socketId] = {};
  }
  eventLockMap[socketId][eventName] = false;
}

export const EventLockAttemptProceed = (socketId: string, eventName: string): void => {
  if (!EventLockGet(socketId, eventName)) {
    EventLockSetLock(socketId, eventName);
  } else {
    throw new Error(`Event ${eventName} is currently locked for socket ${socketId}`);
  }
}