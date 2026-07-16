import { SOCKET_PORT } from '../config';

import { Server, Socket } from 'socket.io';
import { ModuleLogger } from '../utils/log';
import { SocketSystemHandlers } from './systems/SocketSystem';

export const StartSocketServer = async () => {
  try {
    const io = new Server({
      cors: {
        origin: process.env.CORS_ORIGIN ?? '*',
      },
      transports: ['websocket'],
      maxHttpBufferSize: 1e6,
    });

    io.on('connection', OnConnection);

    io.listen(SOCKET_PORT);
    ServerIO = io;

    ModuleLogger('Socket Server', `Socket server is running on port ${SOCKET_PORT}`);
  } catch (error: any) {
    ModuleLogger('Socket Server', error);
  }
};

const OnConnection = (socket: Socket) => {
  SocketSystemHandlers(socket);

  socket.on('disconnect', () => {
    ModuleLogger('Socket Server', `Client disconnected: ${socket.id}`);
  });
};

export let ServerIO: Server | null = null;
