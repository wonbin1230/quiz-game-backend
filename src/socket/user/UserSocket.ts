import { Socket } from 'socket.io';
import { UserContext } from './UserContext';

export const unregisteredContextMap = new Map<string, UserContext>();
export const userContextMap = new Map<string, UserContext>();

export const UserContextCreation = (socket: Socket): void => {
  const userContext = new UserContext(socket);

  unregisteredContextMap.set(socket.id, userContext);

  userContext.socket.on('ping', () => {
    userContext.socket.emit('pong');
  })

  userContext.socket.on('disconnect', () => {
    unregisteredContextMap.delete(socket.id);

    if (userContext.userId) {
      userContextMap.delete(userContext.userId);
    }
  })
}

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
}