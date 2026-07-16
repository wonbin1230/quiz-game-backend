import { Socket } from 'socket.io';
import { UserContext } from './UserContext';
import { userContextMap, unregisteredContextMap } from './UserContextStore';
import { roomManager } from '../room/RoomManager';
import { ModuleLogger } from '../../utils/log';

export { userContextMap, unregisteredContextMap };

export const UserContextCreation = (socket: Socket): void => {
  const userContext = new UserContext(socket, roomManager);

  unregisteredContextMap.set(socket.id, userContext);

  userContext.socket.on('disconnect', () => {
    unregisteredContextMap.delete(socket.id);

    if (userContext.userId) {
      const gameController = userContext.userGameController;
      if (gameController?.roomName && gameController.roomId) {
        const room = userContext.roomService.GetRoom(gameController.roomName);
        if (room) {
          room.LeaveUser(userContext.userId);
          userContext.socket.leave(gameController.roomId);
        }
        gameController.ClearRoomState();
      }

      userContextMap.delete(userContext.userId);
    }

    ModuleLogger('Socket Server', `Player disconnected: ${userContext.socket.id}`);
  });
};

export const UserContextRegister = (userId: string, socketId: string): void => {
  const userContext = unregisteredContextMap.get(socketId);
  if (!userContext) {
    throw new Error(`No unregistered context found for socket ${socketId}`);
  }

  userContext.userId = userId;

  if (userContextMap.has(userId)) {
    const oldUserContext = userContextMap.get(userId);
    if (oldUserContext && oldUserContext.socket.id !== socketId) {
      oldUserContext.socket.disconnect();
    }
  }

  userContextMap.set(userId, userContext);
  unregisteredContextMap.delete(socketId);
};
