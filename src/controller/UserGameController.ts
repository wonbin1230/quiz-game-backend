import { UserContext } from '../socket/user/UserContext';
import { ControllerBase } from './ControllerBase';
import { roomManagerSocket } from '../socket/systems/SocketSystem';
import { ServerIO } from '../socket/app';

export class UserGameController extends ControllerBase<UserContext> {
  roomName: string | null = null;
  roomId: string | null = null;

  constructor(context: UserContext) {
    super(context, 'UserGame');
  }

  override EventRegisters(): void {
    this.EventRegister('UserGame:JoinRoom', this.OnJoinRoom);
    // this.EventRegister('UserGame:LeaveRoom', this.OnLeaveRoom);
    // this.EventRegister('UserGame:SubmitAnswer', this.OnSubmitAnswer);
  }

  OnJoinRoom = async (data: { roomName: string }) => {
    try {
      if (!this.context.userId) {
        throw new Error('User must be logged in before joining a room.');
      }

      if (this.roomId) {
        throw new Error('User is already in a room. Please leave the current room before joining another.');
      }

      if (!data?.roomName || typeof data.roomName !== 'string') {
        throw new Error('roomName is required and must be a string.');
      }

      const room = roomManagerSocket!.GetRoomSocket(data.roomName);
      if (!room) {
        throw new Error('Room not found.');
      }

      ServerIO!.to(room.roomId).emit('GameRoom:UserJoin', { userId: this.context.userId });

      this.roomName = room.roomName;
      this.roomId = room.roomId;
      this.context.socket.join(room.roomId);

      this.context.socket.emit('GameRoom:UserJoin', { userId: this.context.userId });

      this.EmitSuccessResponse('JoinRoom', { roomId: room.roomId });
    } catch (error: any) {
      this.EmitFailResponse('JoinRoom', error);
    }
  }

  // OnLeaveRoom = async () => {
  //   try {
  //     if (!this.roomId || !this.roomName) {
  //       throw new Error('User is not in a room.');
  //     }

  //     const room = roomManager!.GetRoom(this.roomName);
  //     if (!room) {
  //       throw new Error('Room not found.');
  //     }

  //     roomManager!.RemovePlayer(room.roomName, this.context.userId);

  //     this.context.socket.leave(this.roomId);
  //     this.roomName = null;
  //     this.roomId = null;

  //     this.EmitSuccessResponse('LeaveRoom', { roomName: room.roomName });
  //   } catch (error: any) {
  //     this.EmitFailResponse('LeaveRoom', error);
  //   }
  // }

  // OnSubmitAnswer = async (data: { optionIndex: number }) => {
  //   try {
  //     if (!this.context.userId) {
  //       throw new Error('User must be logged in before submitting an answer.');
  //     }

  //     if (!this.roomId || !this.roomName) {
  //       throw new Error('User must join a room before submitting an answer.');
  //     }

  //     if (typeof data?.optionIndex !== 'number') {
  //       throw new Error('optionIndex is required and must be a number.');
  //     }

  //     const room = roomManager!.GetRoom(this.roomName);
  //     if (!room) {
  //       throw new Error('Room not found.');
  //     }

  //     const game = roomManager!.GetGame(room.roomId);
  //     if (!game) {
  //       throw new Error('Game not found for this room.');
  //     }

  //     // game.SubmitAnswer(this.context.userId, data.optionIndex);

  //     this.EmitSuccessResponse('SubmitAnswer', {
  //       roomId: this.roomId,
  //       questionIndex: game.currentQuizIndex + 1,
  //       selectedOption: data.optionIndex,
  //     });
  //   } catch (error: any) {
  //     this.EmitFailResponse('SubmitAnswer', error);
  //   }
  // }
}
