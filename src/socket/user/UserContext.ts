import { Socket } from 'socket.io';
import { ModuleLogger } from '../../utils/log';

import { UserController } from '../../controller/UserController';

export class UserContext {
  socket: Socket;
  userId = '';

  userController: UserController

  constructor(socket: Socket) {
    this.socket = socket;

    this.userController = new UserController(this);
  }

  MassEventRegister = () => {
    this.userController.EventRegisters();
  }

  EmitSuccessResponse = (event: string, data: any) => {
    this.socket.emit(event, data);
  }

  EmitFailResponse = (event: string, error: any) => {
    ModuleLogger('UserContext', `Error in event ${event}: ${error}`, true);

    this.socket.emit('error', error);
  }
}