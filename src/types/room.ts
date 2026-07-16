export enum RoomState {
  Prepare = 'Prepare',
  InGame = 'InGame',
  Finished = 'Finished',
}

export interface IRoomSnapshot {
  roomId: string;
  managerId: string;
  roomName: string;
  players: string[];
  roomState: RoomState;
  gameState: string | null;
}
