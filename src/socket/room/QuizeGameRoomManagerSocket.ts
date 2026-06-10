import { Socket } from 'socket.io';
import { IRoomBroadcastData, IRoomPrivateMsgData } from '../../types/room';
import { ModuleLogger } from '../../utils/log';
import { userContextMap } from '../user/UserSocket';
import { managerContextMap } from '../manager/ManagerSocket';

export class QuizGameRoomManagerSocket {
  private socket: Socket
  roomId = ''

  constructor(socket: Socket) {
    this.socket = socket;
  }

  public RegisterSocket = () => {
    this.socket.on('handleRoomId', (roomId: string) => {
      this.roomId = roomId;
      this.socket.join(roomId);
      ModuleLogger('QuizGameRoomManagerSocket', `Joined room: ${roomId}`);
    })

    this.socket.on('broadcast', (data: IRoomBroadcastData) => {
      for (const userId of data.userIds) {
        const userContext = userContextMap.get(userId);
        if (!userContext) {
          continue;
        }
        userContext.EmitSuccessResponse(data.msgEvent, data.msgData);
      }
    })

    this.socket.on('privateMsg', (data: IRoomPrivateMsgData) => {
      const userContext = userContextMap.get(data.userId);
      if (!userContext) {
        return;
      }
      userContext.EmitSuccessResponse(data.msgEvent, data.msgData);
    })

    this.socket.on('managerMsg', (data: IRoomPrivateMsgData) => {
      const managerContext = managerContextMap.get(data.userId);
      if (!managerContext) {
        return;
      }
      managerContext.EmitSuccessResponse(data.msgEvent, data.msgData);
    })
  }
}