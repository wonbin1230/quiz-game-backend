import dotenv from 'dotenv';
dotenv.config()

import './utils/log'
import { StartSocketServer } from './socket/app';

const main = async () => {
  await StartSocketServer();
}

main()