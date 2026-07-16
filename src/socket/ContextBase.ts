import { Socket } from 'socket.io';

import { SocketSystem } from '../types/socket';
import { SocketErrorPayload } from '../types/error';
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
    const payload: SocketErrorPayload = {
      event,
      message: error?.message ?? String(error),
      code: error?.code,
    };

    this.socket.emit('error', payload);
    this.socket.emit(`${event}:error`, payload);
    ModuleLogger(this.system, `Error in event ${event}: ${payload.message}`, true);
  }
}
