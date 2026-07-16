import { ManagerContext } from '../socket/manager/ManagerContext';
import { ManagerContextRegister } from '../socket/manager/ManagerSocket';
import { AppError, SocketErrorCode } from '../types/error';
import { ControllerBase } from './ControllerBase';

export class ManagerController extends ControllerBase<ManagerContext> {
  constructor(context: ManagerContext) {
    super(context, 'Manager');
  }

  override EventRegisters(): void {
    this.EventRegister('Manager:Login', this.OnLogin);
  }

  OnLogin = async (data: { managerId: string }) => {
    if (!data?.managerId || typeof data.managerId !== 'string') {
      throw new AppError('managerId is required and must be a string.', SocketErrorCode.VALIDATION);
    }

    if (this.context.managerId && this.context.managerId !== data.managerId) {
      throw new AppError(
        'Manager is already logged in with a different id.',
        SocketErrorCode.CONFLICT,
      );
    }

    if (!this.context.managerId) {
      this.context.managerId = data.managerId;
      ManagerContextRegister(data.managerId, this.context.socket.id);
      this.context.MassEventRegister();
    }

    this.EmitSuccessResponse('Login', { managerId: data.managerId });
  }
}
