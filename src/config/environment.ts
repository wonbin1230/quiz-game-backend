import dotenv from 'dotenv';
dotenv.config()

export const SOCKET_PORT = process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT) : 3000;