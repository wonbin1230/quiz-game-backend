import { SOCKET_PORT } from '../config';

import { Server } from 'socket.io';
import { ModuleLogger } from '../utils/log';
import { UserContextCreation } from './user/UserSocket';

export const StartSocketServer = async () => {
  try {
    const io = new Server({
      cors: {
        origin: '*',
      },
      transports: ['websocket'],
      maxHttpBufferSize: 10e8,
    })

    io.on('connection', OnConnection);

    io.listen(SOCKET_PORT);
    ModuleLogger('Socket Server', `Socket server is running on port ${SOCKET_PORT}`);

  } catch (error: any) {
    ModuleLogger('Socket Server', error);
  }
}

const OnConnection = (socket: any) => {
  ModuleLogger('Socket Server', `New socket connected: ${socket.id}`);

  UserContextCreation(socket);

  socket.on('disconnect', () => {
    ModuleLogger('Socket Server', `User disconnected: ${socket.id}`);
  })
}