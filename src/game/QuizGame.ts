import { Socket } from 'socket.io-client';
import { QuizGameRoomSocket } from '../socket/room/QuizGameRoomSocket';
import { GameState, IQuizData } from '../types/quiz-game';
import { RoomState } from '../types/room';
import { quizList } from '../data/quiz';
import { ModuleLogger } from '../utils/log';

export class QuizGame {
  private readonly VOTING_TIME = 12;
  private readonly PREPARE_TIME = 3;

  room: QuizGameRoomSocket
  roomId: string
  roomSocket: Socket
  
  currentQuizIndex = 0;
  quizList: IQuizData[] = quizList;
  state: GameState = GameState.Prepare;
  
  private currentAnswers = new Map<string, number>();
  private currentQuestionTimeout: ReturnType<typeof setTimeout> | null = null;

  private currentPrepareTimeout: NodeJS.Timeout | null = null;

  constructor(room: QuizGameRoomSocket, socket: Socket) {
    this.room = room;
    this.roomId = room.roomId;
    this.roomSocket = socket;
  }

  public StartGame() {
    this.Reset();
    if (this.state !== GameState.Prepare) {
      ModuleLogger('QuizGame', 'Attempted to start game, but game is not in Prepare status.', true);
      return;
    }

    this.state = GameState.StartGame;
    this.room.BroadcastMessage('QuizGame:GameStarted', {
      roomId: this.roomId,
      quizCount: this.quizList.length
    });

    this.currentPrepareTimeout = setTimeout(() => {
      this.BroadcastCurrentQuestion();
    }, this.PREPARE_TIME * 1000);
  }

  private BroadcastCurrentQuestion() {
    this.ClearCurrentPrepareTimeout();
    const currentQuiz = this.quizList[this.currentQuizIndex];

    if (!currentQuiz) {
      return;
    }

    this.state = GameState.Voting;
    this.currentAnswers.clear();

    this.room.BroadcastMessage('QuizGame:Question', {
      roomId: this.roomId,
      question: currentQuiz.question,
      options: currentQuiz.options,
      questionIndex: this.currentQuizIndex + 1,
      totalQuestions: this.quizList.length,
      votingTime: this.VOTING_TIME,
    });

    this.ClearCurrentQuestionTimeout();
    this.currentQuestionTimeout = setTimeout(() => {
      this.EndVoting();
    }, this.VOTING_TIME * 1000);
  }

  private EndVoting() {
    if (this.state !== GameState.Voting) {
      return;
    }

    this.state = GameState.Settle;
    const currentQuiz = this.quizList[this.currentQuizIndex];
    const answerSummary = Array.from(this.currentAnswers.entries()).map(([userId, optionIndex]) => ({
      userId,
      optionIndex,
      isCorrect: optionIndex === currentQuiz.answer,
    }));

    this.room.BroadcastMessage('QuizGame:Settle', {
      roomId: this.roomId,
      questionIndex: this.currentQuizIndex + 1,
      correctAnswer: currentQuiz.answer,
      answers: answerSummary,
    });

    this.ShowAnswer();
  }

  private ShowAnswer() {
    this.state = GameState.ShowAnswer;
    const currentQuiz = this.quizList[this.currentQuizIndex];

    this.ClearCurrentQuestionTimeout();

    this.room.BroadcastMessage('QuizGame:AnswerReveal', {
      roomId: this.roomId,
      questionIndex: this.currentQuizIndex + 1,
      correctAnswer: currentQuiz.answer,
      totalAnswers: this.currentAnswers.size,
    });
  }

  public NextQuestion() {
    if (this.state !== GameState.ShowAnswer) {
      throw new Error('Next question can only be triggered during ShowAnswer.');
    }

    if (this.currentQuizIndex >= this.quizList.length - 1) {
      throw new Error('No more questions.');
    }

    this.currentQuizIndex += 1;

    this.room.BroadcastMessage('QuizGame:NextQuestion', {
      roomId: this.roomId,
      nextQuestionIndex: this.currentQuizIndex + 1,
    });

    this.BroadcastCurrentQuestion();
  }

  private ClearCurrentQuestionTimeout() {
    if (this.currentQuestionTimeout) {
      clearTimeout(this.currentQuestionTimeout);
      this.currentQuestionTimeout = null;
    }
  }

  private ClearCurrentPrepareTimeout() {
    if (this.currentPrepareTimeout) {
      clearTimeout(this.currentPrepareTimeout);
      this.currentPrepareTimeout = null;
    }
  }

  private Reset() {
    this.state = GameState.Prepare;
    this.ClearCurrentQuestionTimeout();
    this.ClearCurrentPrepareTimeout();
    this.currentQuizIndex = 0;
    this.currentAnswers.clear();
  }
}