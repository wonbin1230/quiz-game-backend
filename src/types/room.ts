export enum RoomState {
  Prepare = 'Prepare',
  InGame = 'InGame',
  Finished = 'Finished',
}

export const USER_DISCONNECT_GRACE_MS = 60_000;

export interface IPlayerPresence {
  userId: string;
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface IRoomUserPresencePayload {
  userId: string;
  userList: string[];
  userCount: number;
  disconnectedUserIds: string[];
}

export interface IRoomSnapshot {
  roomId: string;
  managerId: string;
  roomName: string;
  players: string[];
  roomState: RoomState;
  gameState: string | null;
}
