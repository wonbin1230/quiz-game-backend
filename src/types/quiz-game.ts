import { RoomState } from './room';

export enum GameState {
  Prepare = 'Prepare',
  StartGame = 'StartGame',
  Voting = 'Voting',
  Settle = 'Settle',
  ShowAnswer = 'ShowAnswer',
  Finished = 'Finished',
}

export function toRoomState(gameState: GameState): RoomState {
  switch (gameState) {
    case GameState.Prepare:
      return RoomState.Prepare;
    case GameState.Finished:
      return RoomState.Finished;
    default:
      return RoomState.InGame;
  }
}

export interface IQuizData {
  question: string;
  options: string[];
  answer: number;
}
