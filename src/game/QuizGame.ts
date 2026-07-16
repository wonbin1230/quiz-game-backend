import { QuizGameRoom } from '../socket/room/QuizGameRoom';
import { GameState, IQuizData } from '../types/quiz-game';
import { AppError, SocketErrorCode } from '../types/error';
import { quizList } from '../data/quiz';

export class QuizGame {
  private readonly PREPARE_TIME = 3;
  private readonly VOTING_TIME = 12;
  private readonly SETTLE_TIME = 3;

  room: QuizGameRoom;
  roomId: string;

  currentQuizIndex = 0;
  quizList: IQuizData[] = quizList;
  state: GameState = GameState.Prepare;

  private currentAnswers = new Map<string, number>();
  private currentQuestionTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentPrepareTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(room: QuizGameRoom) {
    this.room = room;
    this.roomId = room.roomId;
  }

  public StartGame() {
    if (this.state !== GameState.Prepare && this.state !== GameState.Finished) {
      throw new AppError(
        'Game can only start from Prepare or Finished.',
        SocketErrorCode.INVALID_STATE,
      );
    }

    this.Reset();
    this.state = GameState.StartGame;
    this.room.BroadcastMessage('QuizGame:GameStarted', {
      roomId: this.roomId,
      quizCount: this.quizList.length,
    });

    this.currentPrepareTimeout = setTimeout(() => {
      this.BroadcastCurrentQuestion();
    }, this.PREPARE_TIME * 1000);
  }

  public SubmitAnswer(userId: string, optionIndex: number) {
    if (this.state !== GameState.Voting) {
      throw new AppError('Answers can only be submitted during voting.', SocketErrorCode.INVALID_STATE);
    }

    if (!this.room.players.has(userId)) {
      throw new AppError('User is not in this room.', SocketErrorCode.UNAUTHORIZED);
    }

    const currentQuiz = this.quizList[this.currentQuizIndex];
    if (!currentQuiz) {
      throw new AppError('No active question.', SocketErrorCode.INVALID_STATE);
    }

    if (optionIndex < 0 || optionIndex >= currentQuiz.options.length) {
      throw new AppError('Invalid optionIndex.', SocketErrorCode.VALIDATION);
    }

    this.currentAnswers.set(userId, optionIndex);
  }

  public NextQuestion() {
    if (this.state !== GameState.ShowAnswer) {
      throw new AppError(
        'Next question can only be triggered during ShowAnswer.',
        SocketErrorCode.INVALID_STATE,
      );
    }

    if (this.currentQuizIndex >= this.quizList.length - 1) {
      this.FinishGame();
      return;
    }

    this.currentQuizIndex += 1;

    this.room.BroadcastMessage('QuizGame:NextQuestion', {
      roomId: this.roomId,
      nextQuestionIndex: this.currentQuizIndex + 1,
    });

    this.BroadcastCurrentQuestion();
  }

  public Dispose() {
    this.ClearCurrentQuestionTimeout();
    this.ClearCurrentPrepareTimeout();
    this.currentAnswers.clear();
    this.state = GameState.Prepare;
    this.currentQuizIndex = 0;
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
      this.Settle();
    }, this.VOTING_TIME * 1000);
  }

  private Settle() {
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

    this.currentQuestionTimeout = setTimeout(() => {
      this.ShowAnswer(); 
    }, this.SETTLE_TIME * 1000);
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

  private FinishGame() {
    this.state = GameState.Finished;
    this.ClearCurrentQuestionTimeout();
    this.ClearCurrentPrepareTimeout();

    this.room.BroadcastMessage('QuizGame:Finished', {
      roomId: this.roomId,
      totalQuestions: this.quizList.length,
    });
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
