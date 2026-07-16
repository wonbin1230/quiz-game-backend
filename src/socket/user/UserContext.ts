import { Socket } from 'socket.io';

import { SocketSystem } from '../../types/socket';
import { ContextBase } from '../ContextBase';
import { IRoomService } from '../room/IRoomService';
import { UserController } from '../../controller/UserController';
import { UserGameController } from '../../controller/UserGameController';

export class UserContext extends ContextBase {
  userId = '';
  roomService: IRoomService;

  userController: UserController;
  userGameController: UserGameController;

  constructor(socket: Socket, roomService: IRoomService) {
    super(SocketSystem.User, socket);
    this.roomService = roomService;

    this.userController = new UserController(this);
    this.userGameController = new UserGameController(this);

    // Login is available immediately; business events wait for MassEventRegister
    this.userController.EventRegisters();
  }

  MassEventRegister = () => {
    this.userGameController.EventRegisters();
  }
}
