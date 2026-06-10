import { ManagerContext } from '../socket/manager/ManagerContext';
import { ControllerBase } from './ControllerBase';
import { roomManagerSocket } from '../socket/systems/SocketSystem';

export class RoomController extends ControllerBase<ManagerContext> {
  constructor(context: ManagerContext) {
    super(context, 'Room');
  }

  override EventRegisters(): void {
    this.EventRegister('Room:CreateRoom', this.OnCreateRoom);
    this.EventRegister('Room:StartGame', this.OnStartGame);
  }

  OnCreateRoom = async (data: { roomName: string }) => {
    try {
      if (!this.context.managerId) {
        throw new Error('Manager must be logged in before creating a room.');
      }

      if (!data?.roomName || typeof data.roomName !== 'string') {
        throw new Error('roomName is required and must be a string.');
      }

      const room = await roomManagerSocket!.CreateRoomSocket(this.context.managerId, data.roomName);

      if (!room) {
        throw new Error('Failed to create room. Please try again.');
      }

      this.context.socket.join(room.roomId);

      this.EmitSuccessResponse('CreateRoom', { roomId: room.roomId });
    } catch (error: any) {
      this.EmitFailResponse('CreateRoom', error);
    }
  }

  OnStartGame = async (data: { roomName: string }) => {
    try {
      if (!this.context.managerId) {
        throw new Error('Manager must be logged in before starting a room.');
      }

      if (!data?.roomName || typeof data.roomName !== 'string') {
        throw new Error('roomName is required and must be a string.');
      }

      const room = roomManagerSocket!.GetRoomSocket(data.roomName);
      if (!room) {
        throw new Error('Room not found.');
      }

      if (room.managerId !== this.context.managerId) {
        throw new Error('Only the room owner can start this game.');
      }

      const gameState = room.StartGame();

      this.EmitSuccessResponse('StartGame', {
        roomId: room.roomId,
        roomState: room.roomState,
        gameState: gameState,
      });
    } catch (error: any) {
      this.EmitFailResponse('StartGame', error);
    }
  }
}
