import { RoomState } from './room';

export enum GameState {
  Prepare = 'Prepare',
  StartGame = 'StartGame',
  Voting = 'Voting',
  Settle = 'Settle',
  ShowAnswer = 'ShowAnswer',
  ShowRanking = 'ShowRanking',
  Finished = 'Finished',
}

export interface IPlayerStats {
  correctCount: number;
  totalTimeMs: number;
}

export interface IRankingEntry {
  userId: string;
  rank: number;
  correctCount: number;
  /** 總答題時長（秒），精確到小數點後 2 位 */
  totalTime: number;
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
