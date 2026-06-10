export enum RoomState {
  Prepare = 'Prepare',
  InGame = 'InGame',
  Finished = 'Finished',
}

export interface IRoomData {
  roomId: string;
  managerId: string;
  roomName: string;
  players: Set<string>;
  state: RoomState;
  createdAt: Date;
}

export interface IRoomBroadcastData {
  userIds: string[]
  msgEvent: string
  msgData: any
}

export interface IRoomPrivateMsgData {
  userId: string
  msgEvent: string
  msgData: any
}