import { ManagerContext } from '../socket/manager/ManagerContext';
import { ManagerContextRegister } from '../socket/manager/ManagerSocket';
import { ControllerBase } from './ControllerBase';

export class ManagerController extends ControllerBase<ManagerContext> {
  constructor(context: ManagerContext) {
    super(context, 'Manager');
    this.context.socket.on('Manager:Login', this.OnLogin);
  }

  override EventRegisters(): void {}

  OnLogin = async (data: { managerId: string }) => {
    try {
      this.context.managerId = data.managerId;

      ManagerContextRegister(data.managerId, this.context.socket.id);

      this.context.MassEventRegister();

      this.EmitSuccessResponse('Login', { managerId: data.managerId });
    } catch (error: any) {
      this.EmitFailResponse('Login', error);
    }
  }
}