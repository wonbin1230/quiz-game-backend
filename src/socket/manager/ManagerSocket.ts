import { Socket } from 'socket.io';
import { ManagerContext } from './ManagerContext';
import { ModuleLogger } from '../../utils/log';
import { roomManagerSocket } from '../systems/SocketSystem';

export const unregisteredContextMap = new Map<string, ManagerContext>();
export const managerContextMap = new Map<string, ManagerContext>();

export const ManagerContextCreation = (socket: Socket): void => {
  const managerContext = new ManagerContext(socket);

  unregisteredContextMap.set(socket.id, managerContext);

  managerContext.socket.on('disconnect', () => {
    unregisteredContextMap.delete(socket.id);

    if (managerContext.managerId) {
      managerContextMap.delete(managerContext.managerId);
      if (roomManagerSocket) {
        roomManagerSocket.DeleteRoomsByManager(managerContext.managerId);
      }
    }

    ModuleLogger('Socket Server', `Manager disconnected: ${managerContext.socket.id}`);
  })
}

export const ManagerContextRegister = (managerId: string, socketId: string): void => {
  const managerContext = unregisteredContextMap.get(socketId);
  if (!managerContext) {
    throw new Error(`No unregistered context found for socket ${socketId}`);
  }

  managerContext.managerId = managerId;

  if (managerContextMap.has(managerId)) {
    const oldManagerContext = managerContextMap.get(managerId);
    if (oldManagerContext && oldManagerContext.socket.id !== socketId) {
      oldManagerContext.socket.disconnect();
    }
  }

  managerContextMap.set(managerId, managerContext);
  unregisteredContextMap.delete(socketId);
}