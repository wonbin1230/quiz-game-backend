import { Socket } from 'socket.io';

import { SocketSystem } from '../types/socket';
import { ModuleLogger } from '../utils/log';

export abstract class ContextBase {
  system: SocketSystem;
  socket: Socket;

  constructor(system: SocketSystem, socket: Socket) {
    this.system = system;
    this.socket = socket;
  }

  abstract MassEventRegister: () => void;

  EmitSuccessResponse = (event: string, data: any) => {
    this.socket.emit(event, data);
  }

  EmitFailResponse = (event: string, error: any) => {
    this.socket.emit('error', error?.message ?? error);
    ModuleLogger(this.system, `Error in event ${event}: ${error}`, true);
  }
}