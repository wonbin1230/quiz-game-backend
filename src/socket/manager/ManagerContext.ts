import { Socket } from 'socket.io';

import { SocketSystem } from '../../types/socket';
import { ContextBase } from '../ContextBase';
import { IRoomService } from '../room/IRoomService';
import { ManagerController } from '../../controller/ManagerController';
import { RoomController } from '../../controller/RoomController';

export class ManagerContext extends ContextBase {
  managerId = '';
  roomService: IRoomService;

  managerController: ManagerController;
  roomController: RoomController;

  constructor(socket: Socket, roomService: IRoomService) {
    super(SocketSystem.Manager, socket);
    this.roomService = roomService;
    this.managerController = new ManagerController(this);
    this.roomController = new RoomController(this);

    // Login is available immediately; business events wait for MassEventRegister
    this.managerController.EventRegisters();
  }

  MassEventRegister = () => {
    this.roomController.EventRegisters();
  }
}
