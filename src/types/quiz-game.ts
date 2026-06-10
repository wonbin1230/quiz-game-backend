export enum GameState {
  Prepare = 'Prepare',
  StartGame = 'StartGame',
  Voting = 'Voting',
  Settle = 'Settle',
  ShowAnswer = 'ShowAnswer',
  Waiting = 'Waiting',
  Finished = 'Finished',
}

export interface IQuizData {
  question: string;
  options: string[];
  answer: number;
}