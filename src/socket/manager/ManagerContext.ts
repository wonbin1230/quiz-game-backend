import { Socket } from 'socket.io';

import { SocketSystem } from '../../types/socket';

import { ModuleLogger } from '../../utils/log';
import { ContextBase } from '../ContextBase';
import { ManagerController } from '../../controller/ManagerController';
import { RoomController } from '../../controller/RoomController';

export class ManagerContext extends ContextBase {
  managerId = '';

  managerController: ManagerController
  roomController: RoomController

  constructor(socket: Socket) {
    super(SocketSystem.Manager, socket);
    this.managerController = new ManagerController(this);
    this.roomController = new RoomController(this);
  }

  MassEventRegister = () => {
    this.managerController.EventRegisters();
    this.roomController.EventRegisters();
  }
}