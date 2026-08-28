import { UserContext } from '../socket/user/UserContext';
import { UserContextRegister, UserContextRename } from '../socket/user/UserSocket';
import { userContextMap } from '../socket/user/UserContextStore';
import { RoomState } from '../types/room';
import { AppError, SocketErrorCode } from '../types/error';
import { ControllerBase } from './ControllerBase';

export class UserController extends ControllerBase<UserContext> {
  constructor(context: UserContext) {
    super(context, 'User');
  }

  override EventRegisters(): void {
    this.EventRegister('User:Login', this.OnLogin);
  }

  OnLogin = async (data: { userId: string }) => {
    if (!data?.userId || typeof data.userId !== 'string') {
      throw new AppError('userId is required and must be a string.', SocketErrorCode.VALIDATION);
    }

    const newUserId = data.userId;
    const oldUserId = this.context.userId;

    if (oldUserId && oldUserId !== newUserId) {
      this.RenameLoggedInUser(oldUserId, newUserId);
    } else if (!oldUserId) {
      UserContextRegister(newUserId, this.context.socket.id);
      this.context.MassEventRegister();
    }

    this.context.userGameController.BindExistingRoom();

    this.EmitSuccessResponse('Login', { userId: newUserId });
    this.context.userGameController.EmitSessionSnapshot();
  }

  private RenameLoggedInUser = (oldUserId: string, newUserId: string) => {
    const existing = userContextMap.get(newUserId);
    if (existing && existing !== this.context) {
      throw new AppError(
        'This userId is already in use (duplicate name).',
        SocketErrorCode.CONFLICT,
      );
    }

    const occupiedRoom = this.context.roomService.FindRoomByUserId(newUserId);
    if (occupiedRoom) {
      throw new AppError(
        'This userId is already in use (duplicate name).',
        SocketErrorCode.CONFLICT,
      );
    }

    const currentRoom =
      (this.context.userGameController.roomName
        ? this.context.roomService.GetRoom(this.context.userGameController.roomName)
        : undefined)
      ?? this.context.roomService.FindRoomByUserId(oldUserId);

    if (currentRoom?.HasPlayer(oldUserId) && currentRoom.roomState !== RoomState.Prepare) {
      throw new AppError(
        'Cannot change name after the game has started.',
        SocketErrorCode.INVALID_STATE,
      );
    }

    UserContextRename(oldUserId, newUserId, this.context);

    if (currentRoom?.HasPlayer(oldUserId)) {
      currentRoom.RenameUser(oldUserId, newUserId, this.context.socket.id);
    }
  }
}
