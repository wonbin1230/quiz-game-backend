import { Socket } from 'socket.io';

import { SocketSystem } from '../../types/socket';

import { ModuleLogger } from '../../utils/log';
import { ContextBase } from '../ContextBase';
import { UserController } from '../../controller/UserController';
import { UserGameController } from '../../controller/UserGameController';

export class UserContext extends ContextBase {
  userId = '';

  userController: UserController
  userGameController: UserGameController

  constructor(socket: Socket) {
    super(SocketSystem.User, socket);

    this.userController = new UserController(this);
    this.userGameController = new UserGameController(this);
  }

  MassEventRegister = () => {
    this.userController.EventRegisters();
    this.userGameController.EventRegisters();
  }
}