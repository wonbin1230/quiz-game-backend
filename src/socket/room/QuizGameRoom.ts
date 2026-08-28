import { randomUUID } from 'crypto';
import { IPlayerPresence, IRoomUserPresencePayload, RoomState, USER_DISCONNECT_GRACE_MS } from '../../types/room';
import { GameState, ISessionSnapshot, toRoomState } from '../../types/quiz-game';
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
  players: Map<string, IPlayerPresence> = new Map();
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  get roomState(): RoomState {
    if (!this.game) {
      return RoomState.Prepare;
    }
    return toRoomState(this.game.state);
  }

  get playerIds(): string[] {
    return Array.from(this.players.keys());
  }

  get disconnectedUserIds(): string[] {
    return Array.from(this.players.values())
      .filter((player) => !player.connected)
      .map((player) => player.userId);
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

  public FinishGame = () => {
    if (!this.game) {
      throw new AppError('Game instance is not initialized.', SocketErrorCode.INVALID_STATE);
    }
    this.game.FinishGame();
  }

  public JoinUser = (userId: string, socketId: string) => {
    if (this.roomState !== RoomState.Prepare) {
      throw new AppError('Room is already in progress or finished.', SocketErrorCode.INVALID_STATE);
    }

    if (!userId) {
      throw new AppError('userId is required to join the room.', SocketErrorCode.VALIDATION);
    }

    if (this.players.has(userId)) {
      throw new AppError('User is already in the room.', SocketErrorCode.CONFLICT);
    }

    this.players.set(userId, {
      userId,
      socketId,
      connected: true,
      disconnectedAt: null,
    });
    this.NotifyManager('Room:UserJoined', this.BuildUserPresencePayload(userId));
  }

  public RenameUser = (oldUserId: string, newUserId: string, socketId: string) => {
    if (this.roomState !== RoomState.Prepare) {
      throw new AppError('Cannot change name after the game has started.', SocketErrorCode.INVALID_STATE);
    }

    if (!this.players.has(oldUserId)) {
      throw new AppError('User is not in this room.', SocketErrorCode.INVALID_STATE);
    }

    if (this.players.has(newUserId)) {
      throw new AppError(
        'This userId is already in use (duplicate name).',
        SocketErrorCode.CONFLICT,
      );
    }

    this.LeaveUser(oldUserId);
    this.JoinUser(newUserId, socketId);
  }

  public LeaveUser = (userId: string) => {
    if (!this.players.has(userId)) {
      return;
    }

    this.ClearDisconnectTimer(userId);
    this.players.delete(userId);
    this.game?.RemovePlayer(userId);
    this.NotifyManager('Room:UserLeft', this.BuildUserPresencePayload(userId));
  }

  public HandleUserDisconnect = (userId: string) => {
    const player = this.players.get(userId);
    if (!player || !player.connected) {
      return;
    }

    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();

    this.ClearDisconnectTimer(userId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      const current = this.players.get(userId);
      if (current && !current.connected) {
        this.LeaveUser(userId);
      }
    }, USER_DISCONNECT_GRACE_MS);
    this.disconnectTimers.set(userId, timer);

    this.NotifyManager('Room:UserDisconnected', this.BuildUserPresencePayload(userId));
  }

  public ReconnectUser = (userId: string, socketId: string) => {
    const player = this.players.get(userId);
    if (!player) {
      return;
    }

    const wasDisconnected = !player.connected;
    this.ClearDisconnectTimer(userId);
    player.connected = true;
    player.socketId = socketId;
    player.disconnectedAt = null;

    if (wasDisconnected) {
      this.NotifyManager('Room:UserReconnected', this.BuildUserPresencePayload(userId));
    }
  }

  public HasPlayer = (userId: string) => {
    return this.players.has(userId);
  }

  public BuildSessionSnapshot = (userId: string): ISessionSnapshot => {
    if (!this.players.has(userId)) {
      return { inRoom: false };
    }

    if (!this.game) {
      return {
        inRoom: true,
        roomId: this.roomId,
        roomName: this.roomName,
        roomState: this.roomState,
        gameState: GameState.Prepare,
        quizCount: 0,
      };
    }

    return this.game.BuildSessionSnapshot(userId);
  }

  public BroadcastMessage = (event: string, data: any) => {
    this.NotifyManager(event, data);

    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      const userContext = userContextMap.get(player.userId);
      if (!userContext) {
        continue;
      }
      userContext.EmitSuccessResponse(event, data);
    }
  }

  public EmitToUser = (userId: string, event: string, data: any) => {
    const userContext = userContextMap.get(userId);
    if (!userContext) {
      return;
    }
    userContext.EmitSuccessResponse(event, data);
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
    for (const userId of this.disconnectTimers.keys()) {
      this.ClearDisconnectTimer(userId);
    }
    this.game?.Dispose();
    this.players.clear();
    this.game = null;
  }

  private BuildUserPresencePayload = (userId: string): IRoomUserPresencePayload => {
    return {
      userId,
      userList: this.playerIds,
      userCount: this.players.size,
      disconnectedUserIds: this.disconnectedUserIds,
    };
  }

  private ClearDisconnectTimer = (userId: string) => {
    const timer = this.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(userId);
    }
  }
}
