import { ManagerContext } from '../../socket/manager/ManagerContext';
import { QuizGameRoom } from '../../socket/room/QuizGameRoom';
import { AppError, SocketErrorCode } from '../../types/error';
import { EventMiddleware } from '../ControllerBase';

export type WithRoomName = { roomName: string };
export type WithOwnedRoom = WithRoomName & { room: QuizGameRoom };

export const requireManagerLogin: EventMiddleware<ManagerContext> = (_data, context) => {
  if (!context.managerId) {
    throw new AppError('Manager must be logged in.', SocketErrorCode.UNAUTHORIZED);
  }
};

export const requireRoomName: EventMiddleware<ManagerContext, any, WithRoomName> = (data) => {
  if (!data?.roomName || typeof data.roomName !== 'string') {
    throw new AppError('roomName is required and must be a string.', SocketErrorCode.VALIDATION);
  }
  return data;
};

export const requireOwnedRoom: EventMiddleware<ManagerContext, WithRoomName, WithOwnedRoom> = (data, context) => {
  const room = context.roomService.GetRoom(data.roomName);
  if (!room) {
    throw new AppError('Room not found.', SocketErrorCode.NOT_FOUND);
  }

  if (room.managerId !== context.managerId) {
    throw new AppError('Only the room owner can perform this action.', SocketErrorCode.UNAUTHORIZED);
  }

  return { ...data, room };
};
