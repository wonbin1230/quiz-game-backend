import dotenv from 'dotenv';
dotenv.config()

import './utils/log'
import { StartSocketServer } from './socket/app';
import { InitRoomManagerSocket } from './socket/room/RoomManagerSocket';

const main = async () => {
  await StartSocketServer();

  InitRoomManagerSocket();
}

main()