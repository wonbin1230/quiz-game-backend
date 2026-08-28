import { QuizGameRoom } from './QuizGameRoom';

export interface IRoomService {
  CreateRoom(managerId: string, roomName: string): QuizGameRoom;
  GetRoom(roomName: string): QuizGameRoom | undefined;
  FindRoomByUserId(userId: string): QuizGameRoom | undefined;
  DeleteRoomsByManager(managerId: string): void;
}
