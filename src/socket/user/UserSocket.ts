import { Socket } from 'socket.io';
import { UserContext } from './UserContext';
import { userContextMap, unregisteredContextMap } from './UserContextStore';
import { roomManager } from '../room/RoomManager';
import { ModuleLogger } from '../../utils/log';
import { EventLockClearSocket } from '../../utils/rate-limit';
import { AppError, SocketErrorCode } from '../../types/error';

export { userContextMap, unregisteredContextMap };

export const UserContextCreation = (socket: Socket): void => {
  const userContext = new UserContext(socket, roomManager);

  unregisteredContextMap.set(socket.id, userContext);

  userContext.socket.on('disconnect', () => {
    unregisteredContextMap.delete(socket.id);
    EventLockClearSocket(userContext.socket.id);

    if (userContext.userId) {
      const mappedContext = userContextMap.get(userContext.userId);
      if (mappedContext === userContext) {
        userContextMap.delete(userContext.userId);
      }

      const gameController = userContext.userGameController;
      const room =
        (gameController?.roomName ? userContext.roomService.GetRoom(gameController.roomName) : undefined)
        ?? userContext.roomService.FindRoomByUserId(userContext.userId);

      if (room?.HasPlayer(userContext.userId)) {
        room.HandleUserDisconnect(userContext.userId);
      }

      gameController?.ClearRoomState();
    }

    ModuleLogger('Socket Server', `Player disconnected: ${userContext.socket.id}`);
  });
};

export const UserContextRegister = (userId: string, socketId: string): void => {
  const userContext = unregisteredContextMap.get(socketId);
  if (!userContext) {
    throw new Error(`No unregistered context found for socket ${socketId}`);
  }

  const existing = userContextMap.get(userId);
  if (existing && existing.socket.id !== socketId) {
    throw new AppError(
      'This userId is already in use (duplicate name).',
      SocketErrorCode.CONFLICT,
    );
  }

  userContext.userId = userId;
  userContextMap.set(userId, userContext);
  unregisteredContextMap.delete(socketId);
};

export const UserContextRename = (oldUserId: string, newUserId: string, userContext: UserContext): void => {
  const mapped = userContextMap.get(oldUserId);
  if (mapped !== userContext) {
    throw new AppError('User is not registered with the expected id.', SocketErrorCode.INVALID_STATE);
  }

  const existing = userContextMap.get(newUserId);
  if (existing && existing !== userContext) {
    throw new AppError(
      'This userId is already in use (duplicate name).',
      SocketErrorCode.CONFLICT,
    );
  }

  userContextMap.delete(oldUserId);
  userContext.userId = newUserId;
  userContextMap.set(newUserId, userContext);
};
