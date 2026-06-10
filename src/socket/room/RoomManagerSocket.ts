import { io as ClientIO } from 'socket.io-client';
import { Socket } from 'socket.io';

import { ModuleLogger } from '../../utils/log';
import { SOCKET_PORT } from '../../config';
import { QuizGameRoomSocket } from './QuizGameRoomSocket';
import { userContextMap } from '../user/UserSocket';
import { ServerIO } from '../app';

export class RoomManagerSocket {
  socket: Socket;
  roomList: Map<string, QuizGameRoomSocket> = new Map();

  constructor(socket: Socket) {
    ModuleLogger('RoomManagerSocket', 'Room Manager connected');
    this.socket = socket;
  }
  
  public async CreateRoomSocket(managerId: string, roomName: string) {
    try {
      if (this.roomList.has(roomName)) {
        throw new Error('Room name already exists. Please choose a different name.');
      }
      const socket = CreateRoomSocket();
      const roomSocket = new QuizGameRoomSocket(socket);
      try {
        await roomSocket.Prepare(managerId, roomName);
        this.roomList.set(roomName, roomSocket);
        ModuleLogger('RoomManagerSocket', `Room socket created for room: ${roomName}`);
        return roomSocket;
      } catch (prepareError: any) {
        ModuleLogger('RoomManagerSocket', `Failed to prepare room socket: ${prepareError.message}`, true);
      }
    } catch (error: any) {
      ModuleLogger('RoomManagerSocket', `Failed to create room socket: ${error.message}`, true);
    }
  }

  public GetRoomSocket(roomName: string) {
    return this.roomList.get(roomName);
  }

  public DeleteRoomsByManager(managerId: string) {
    const removedRooms: string[] = [];

    for (const [roomName, roomSocket] of this.roomList.entries()) {
      if (roomSocket.managerId === managerId) {
        for (const userId of roomSocket.players) {
          const userContext = userContextMap.get(userId);
          if (!userContext) {
            continue;
          }

          // Clear user's room state on the server-side controller
          try {
            if (userContext.userGameController) {
              userContext.userGameController.roomId = null;
              userContext.userGameController.roomName = null;
            }
          } catch (err) {
            ModuleLogger('RoomManagerSocket', `Failed to clear user game state for ${userId}: ${err}`, true);
          }

          userContext.socket.leave(roomSocket.roomId);
          userContext.EmitSuccessResponse('Room:Closed', {
            roomName: roomSocket.roomName,
            roomId: roomSocket.roomId,
            reason: 'Manager disconnected',
          });
        }

        roomSocket.players.clear();

        if (ServerIO) {
          ServerIO.socketsLeave(roomSocket.roomId);
        }

        roomSocket.socket.disconnect();
        this.roomList.delete(roomName);
        removedRooms.push(roomName);
      }
    }

    if (removedRooms.length > 0) {
      ModuleLogger('RoomManagerSocket', `Deleted rooms for manager ${managerId}: ${removedRooms.join(', ')}`);
    }
  }
}

const CreateRoomSocket = () => {
  const socket = ClientIO(`http://localhost:${SOCKET_PORT}`, {
    query: {
      system: 'RoomSocket'
    },
    transports: ['websocket']
  })
  return socket;
}

export const InitRoomManagerSocket = () => {
  const socket = ClientIO(`http://localhost:${SOCKET_PORT}`, {
    query: {
      system: 'RoomManagerSocket'
    },
    transports: ['websocket']
  })

  socket.on('connect', () => {
    ModuleLogger('RoomManagerSocket', 'Connected to Socket Server');

    socket.on('disconnect', () => {
      ModuleLogger('RoomManagerSocket', 'Disconnected from Socket Server');
    });
  })
}