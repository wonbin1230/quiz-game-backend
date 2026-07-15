import { ManagerContext } from '../../socket/manager/ManagerContext';
import { QuizGameRoomSocket } from '../../socket/room/QuizGameRoomSocket';
import { roomManagerSocket } from '../../socket/systems/SocketSystem';
import { EventMiddleware } from '../ControllerBase';

export type WithRoomName = { roomName: string };
export type WithOwnedRoom = WithRoomName & { room: QuizGameRoomSocket };

export const requireManagerLogin: EventMiddleware<ManagerContext> = (_data, context) => {
  if (!context.managerId) {
    throw new Error('Manager must be logged in.');
  }
};

export const requireRoomName: EventMiddleware<ManagerContext, any, WithRoomName> = (data) => {
  if (!data?.roomName || typeof data.roomName !== 'string') {
    throw new Error('roomName is required and must be a string.');
  }
  return data;
};

export const requireOwnedRoom: EventMiddleware<ManagerContext, WithRoomName, WithOwnedRoom> = (data, context) => {
  const room = roomManagerSocket!.GetRoomSocket(data.roomName);
  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.managerId !== context.managerId) {
    throw new Error('Only the room owner can perform this action.');
  }

  return { ...data, room };
};
