import { QuizGameRoom } from './QuizGameRoom';
import { IRoomService } from './IRoomService';
import { userContextMap } from '../user/UserContextStore';
import { ServerIO } from '../app';
import { ModuleLogger } from '../../utils/log';
import { AppError, SocketErrorCode } from '../../types/error';

export class RoomManager implements IRoomService {
  roomList: Map<string, QuizGameRoom> = new Map();

  public CreateRoom(managerId: string, roomName: string) {
    if (this.roomList.has(roomName)) {
      throw new AppError(
        'Room name already exists. Please choose a different name.',
        SocketErrorCode.CONFLICT,
      );
    }

    const room = new QuizGameRoom();
    room.Prepare(managerId, roomName);
    this.roomList.set(roomName, room);
    ModuleLogger('RoomManager', `Room created: ${roomName}`);
    return room;
  }

  public GetRoom(roomName: string) {
    return this.roomList.get(roomName);
  }

  public FindRoomByUserId(userId: string) {
    for (const room of this.roomList.values()) {
      if (room.HasPlayer(userId)) {
        return room;
      }
    }
    return undefined;
  }

  public DeleteRoomsByManager(managerId: string) {
    const removedRooms: string[] = [];

    for (const [roomName, room] of this.roomList.entries()) {
      if (room.managerId !== managerId) {
        continue;
      }

      for (const userId of room.playerIds) {
        const userContext = userContextMap.get(userId);
        if (!userContext) {
          continue;
        }

        try {
          if (userContext.userGameController) {
            userContext.userGameController.ClearRoomState();
          }
        } catch (err) {
          ModuleLogger('RoomManager', `Failed to clear user game state for ${userId}: ${err}`, true);
        }

        userContext.socket.leave(room.roomId);
        userContext.EmitSuccessResponse('Room:Closed', {
          roomName: room.roomName,
          roomId: room.roomId,
          reason: 'Manager disconnected',
        });
      }

      room.Dispose();

      if (ServerIO) {
        ServerIO.socketsLeave(room.roomId);
      }

      this.roomList.delete(roomName);
      removedRooms.push(roomName);
    }

    if (removedRooms.length > 0) {
      ModuleLogger('RoomManager', `Deleted rooms for manager ${managerId}: ${removedRooms.join(', ')}`);
    }
  }
}

export const roomManager: IRoomService = new RoomManager();
