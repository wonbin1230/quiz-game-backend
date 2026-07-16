import { UserContext } from '../socket/user/UserContext';
import { AppError, SocketErrorCode } from '../types/error';
import { ControllerBase } from './ControllerBase';

export class UserGameController extends ControllerBase<UserContext> {
  roomName: string | null = null;
  roomId: string | null = null;

  constructor(context: UserContext) {
    super(context, 'UserGame');
  }

  override EventRegisters(): void {
    this.EventRegister('UserGame:JoinRoom', this.OnJoinRoom);
    this.EventRegister('UserGame:LeaveRoom', this.OnLeaveRoom);
    this.EventRegister('UserGame:SubmitAnswer', this.OnSubmitAnswer);
  }

  OnJoinRoom = async (data: { roomName: string }) => {
    if (!this.context.userId) {
      throw new AppError('User must be logged in before joining a room.', SocketErrorCode.UNAUTHORIZED);
    }

    if (this.roomId) {
      throw new AppError(
        'User is already in a room. Please leave the current room before joining another.',
        SocketErrorCode.CONFLICT,
      );
    }

    if (!data?.roomName || typeof data.roomName !== 'string') {
      throw new AppError('roomName is required and must be a string.', SocketErrorCode.VALIDATION);
    }

    const room = this.context.roomService.GetRoom(data.roomName);
    if (!room) {
      throw new AppError('Room not found.', SocketErrorCode.NOT_FOUND);
    }

    room.JoinUser(this.context.userId);

    this.roomName = room.roomName;
    this.roomId = room.roomId;
    this.context.socket.join(room.roomId);

    this.EmitSuccessResponse('JoinRoom', { roomId: room.roomId });
  }

  OnLeaveRoom = async () => {
    if (!this.roomId || !this.roomName || !this.context.userId) {
      throw new AppError('User is not in a room.', SocketErrorCode.INVALID_STATE);
    }

    const room = this.context.roomService.GetRoom(this.roomName);
    if (!room) {
      throw new AppError('Room not found.', SocketErrorCode.NOT_FOUND);
    }

    room.LeaveUser(this.context.userId);
    this.context.socket.leave(this.roomId);

    this.roomName = null;
    this.roomId = null;

    this.EmitSuccessResponse('LeaveRoom', { success: true });
  }

  OnSubmitAnswer = async (data: { optionIndex: number }) => {
    if (!this.context.userId) {
      throw new AppError('User must be logged in before submitting an answer.', SocketErrorCode.UNAUTHORIZED);
    }

    if (!this.roomId || !this.roomName) {
      throw new AppError('User must join a room before submitting an answer.', SocketErrorCode.INVALID_STATE);
    }

    if (typeof data?.optionIndex !== 'number') {
      throw new AppError('optionIndex is required and must be a number.', SocketErrorCode.VALIDATION);
    }

    const room = this.context.roomService.GetRoom(this.roomName);
    if (!room?.game) {
      throw new AppError('Game not found for this room.', SocketErrorCode.NOT_FOUND);
    }

    room.game.SubmitAnswer(this.context.userId, data.optionIndex);

    this.EmitSuccessResponse('SubmitAnswer', {
      roomId: this.roomId,
      questionIndex: room.game.currentQuizIndex + 1,
      selectedOption: data.optionIndex,
    });
  }

  ClearRoomState = () => {
    this.roomName = null;
    this.roomId = null;
  }
}
