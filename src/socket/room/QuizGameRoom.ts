import { randomUUID } from 'crypto';
import { RoomState } from '../../types/room';
import { toRoomState } from '../../types/quiz-game';
import { QuizGame } from '../../game/QuizGame';
import { AppError, SocketErrorCode } from '../../types/error';
import { ModuleLogger } from '../../utils/log';
import { userContextMap } from '../user/UserContextStore';
import { managerContextMap } from '../manager/ManagerContextStore';

export class QuizGameRoom {
  roomName = '';
  roomId = randomUUID();
  managerId = '';

  game: QuizGame | null = null;
  players: Set<string> = new Set();

  get roomState(): RoomState {
    if (!this.game) {
      return RoomState.Prepare;
    }
    return toRoomState(this.game.state);
  }

  public Prepare(managerId: string, roomName: string) {
    this.managerId = managerId;
    this.roomName = roomName;
    this.game = new QuizGame(this);
  }

  public StartGame = () => {
    if (!this.game) {
      throw new AppError('Game instance is not initialized.', SocketErrorCode.INVALID_STATE);
    }

    this.game.StartGame();
    return this.game.state;
  }

  public NextQuestion = () => {
    if (!this.game) {
      throw new AppError('Game instance is not initialized.', SocketErrorCode.INVALID_STATE);
    }
    this.game.NextQuestion();
  }

  public JoinUser = (userId: string) => {
    if (this.roomState !== RoomState.Prepare) {
      throw new AppError('Room is already in progress or finished.', SocketErrorCode.INVALID_STATE);
    }

    if (!userId) {
      throw new AppError('userId is required to join the room.', SocketErrorCode.VALIDATION);
    }

    if (this.players.has(userId)) {
      throw new AppError('User is already in the room.', SocketErrorCode.CONFLICT);
    }

    this.players.add(userId);
    this.NotifyManager('Room:UserJoined', {
      userId,
      userList: Array.from(this.players),
      userCount: this.players.size,
    });
  }

  public LeaveUser = (userId: string) => {
    if (!this.players.has(userId)) {
      return;
    }

    this.players.delete(userId);
    this.NotifyManager('Room:UserLeft', {
      userId,
      userList: Array.from(this.players),
      userCount: this.players.size,
    });
  }

  public BroadcastMessage = (event: string, data: any) => {
    this.NotifyManager(event, data);

    for (const userId of this.players) {
      const userContext = userContextMap.get(userId);
      if (!userContext) {
        continue;
      }
      userContext.EmitSuccessResponse(event, data);
    }
  }

  public NotifyManager = (event: string, data: any) => {
    const managerContext = managerContextMap.get(this.managerId);
    if (!managerContext) {
      ModuleLogger('QuizGameRoom', `Manager ${this.managerId} not found for event ${event}`, true);
      return;
    }
    managerContext.EmitSuccessResponse(event, data);
  }

  public Dispose = () => {
    this.game?.Dispose();
    this.players.clear();
    this.game = null;
  }
}
