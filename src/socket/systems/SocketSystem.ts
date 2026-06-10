import { Socket } from 'socket.io';
import { SocketSystem } from '../../types/socket';

import { RoomManagerSocket } from '../room/RoomManagerSocket';
import { ManagerContextCreation } from '../manager/ManagerSocket';
import { UserContextCreation } from '../user/UserSocket';
import { QuizGameRoomManagerSocket } from '../room/QuizeGameRoomManagerSocket';
import { ModuleLogger } from '../../utils/log';

export let roomManagerSocket: RoomManagerSocket | null = null;

export const SocketSystemHandlers = (socket: Socket) => {
  const system = socket.handshake.query.system as SocketSystem

  switch (system) {
    case SocketSystem.RoomManagerSocket:
      roomManagerSocket = new RoomManagerSocket(socket);
      ModuleLogger('Socket Server', `Room Manager connected: ${socket.id}`);
      break;
    case SocketSystem.RoomSocket:
      new QuizGameRoomManagerSocket(socket).RegisterSocket();
      ModuleLogger('Socket Server', `Room socket connected: ${socket.id}`);
      break;
    case SocketSystem.Manager:
      ManagerContextCreation(socket);
      ModuleLogger('Socket Server', `Manager connected: ${socket.id}`);
      break;
    default:
      UserContextCreation(socket);
      ModuleLogger('Socket Server', `Player connected: ${socket.id}`);
      break;
  }
}