import { Socket } from 'socket.io';
import { SocketSystem } from '../../types/socket';

import { ManagerContextCreation } from '../manager/ManagerSocket';
import { UserContextCreation } from '../user/UserSocket';
import { ModuleLogger } from '../../utils/log';

export const SocketSystemHandlers = (socket: Socket) => {
  const system = socket.handshake.query.system as SocketSystem;

  switch (system) {
    case SocketSystem.Manager:
      ManagerContextCreation(socket);
      ModuleLogger('Socket Server', `Manager connected: ${socket.id}`);
      break;
    default:
      UserContextCreation(socket);
      ModuleLogger('Socket Server', `Player connected: ${socket.id}`);
      break;
  }
};
