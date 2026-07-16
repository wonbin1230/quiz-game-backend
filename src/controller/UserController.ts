import { UserContext } from '../socket/user/UserContext';
import { UserContextRegister } from '../socket/user/UserSocket';
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

    if (this.context.userId && this.context.userId !== data.userId) {
      throw new AppError(
        'User is already logged in with a different id.',
        SocketErrorCode.CONFLICT,
      );
    }

    if (!this.context.userId) {
      this.context.userId = data.userId;
      UserContextRegister(data.userId, this.context.socket.id);
      this.context.MassEventRegister();
    }

    this.EmitSuccessResponse('Login', { userId: data.userId });
  }
}
