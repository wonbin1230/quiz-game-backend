import { UserContext } from '../socket/user/UserContext';
import { UserContextRegister } from '../socket/user/UserSocket';
import { ControllerBase } from './ControllerBase';

export class UserController extends ControllerBase<UserContext> {
  constructor(context: UserContext) {
    super(context, 'User');
    this.context.socket.on('User:Login', this.OnLogin);
  }

  override EventRegisters(): void {}

  OnLogin = async (data: { userId: string }) => {
    try {
      this.context.userId = data.userId;

      UserContextRegister(data.userId, this.context.socket.id);

      this.context.MassEventRegister();

      this.EmitSuccessResponse('Login', { userId: data.userId });
    } catch (error: any) {
      this.EmitFailResponse('Login', error);
    }
  }
}
