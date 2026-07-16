import { ManagerContext } from '../socket/manager/ManagerContext';
import { ControllerBase } from './ControllerBase';
import {
  requireManagerLogin,
  requireOwnedRoom,
  requireRoomName,
  WithOwnedRoom,
  WithRoomName,
} from './middlewares/room';

export class RoomController extends ControllerBase<ManagerContext> {
  constructor(context: ManagerContext) {
    super(context, 'Room');
  }

  override EventRegisters(): void {
    this.EventRegister('Room:CreateRoom', this.OnCreateRoom, [
      requireManagerLogin,
      requireRoomName,
    ]);
    this.EventRegister('Room:StartGame', this.OnStartGame, [
      requireManagerLogin,
      requireRoomName,
      requireOwnedRoom,
    ]);
    this.EventRegister('Room:NextQuestion', this.OnNextQuestion, [
      requireManagerLogin,
      requireRoomName,
      requireOwnedRoom,
    ]);
  }

  OnCreateRoom = async (data: WithRoomName) => {
    const room = this.context.roomService.CreateRoom(this.context.managerId, data.roomName);

    this.context.socket.join(room.roomId);

    this.EmitSuccessResponse('CreateRoom', { roomId: room.roomId });
  }

  OnStartGame = async (data: WithOwnedRoom) => {
    const gameState = data.room.StartGame();

    this.EmitSuccessResponse('StartGame', {
      roomId: data.room.roomId,
      roomState: data.room.roomState,
      gameState: gameState,
    });
  }

  OnNextQuestion = async (data: WithOwnedRoom) => {
    data.room.NextQuestion();

    this.EmitSuccessResponse('NextQuestion', {
      roomId: data.room.roomId,
      roomState: data.room.roomState,
      gameState: data.room.game?.state ?? null,
    });
  }
}
