import { Socket } from 'socket.io-client';
import { randomUUID } from 'crypto';
import { IRoomData, RoomState, IRoomBroadcastData, IRoomPrivateMsgData } from '../../types/room';
import { QuizGame } from '../../game/QuizGame';
import { ModuleLogger } from '../../utils/log';

export class QuizGameRoomSocket {
	socket: Socket;
	roomState: RoomState = RoomState.Prepare;

	roomName = '';
	roomId = randomUUID();
	managerId = '';

	game: QuizGame | null = null;
	players: Set<string> = new Set();

	constructor(socket: Socket) {
		this.socket = socket;
	}

	public Prepare(managerId: string, roomName: string) {
		this.managerId = managerId;
		this.roomName = roomName;

		//! 綁定廣播系統
		this.socket.emit('handleRoomId', this.roomId);

		this.socket.on('GameRoom:UserJoin', this.OnUserJoin);

		if (!this.game) {
			this.game = new QuizGame(this, this.socket);
		}
	}

	public StartGame = () => {
		if (!this.game) {
			throw new Error('Game instance is not initialized.');
		}
		this.game.StartGame();

		return this.game.state;
	}

	private OnUserJoin = (data: { userId: string }) => {
		try {
			if (this.roomState !== RoomState.Prepare) {
				throw new Error('Room is already in progress or finished.');
			}

			if (!data.userId) {
				throw new Error('userId is required to join the room.');
			}

			if (this.players.has(data.userId)) {
				throw new Error('User is already in the room.');
			}

			this.players.add(data.userId);

			this.NotifyManager('Room:UserJoined', { userId: data.userId, userList: Array.from(this.players), userCount: this.players.size });
		} catch (error: any) {
      ModuleLogger('QuizGameRoomSocket', `Error in OnUserJoin: ${error.message}`, true);
    }
	}

	private LeaveRoom = (userId: string) => {
		this.players.delete(userId);
	}

	public BroadcastMessage = (event: string, data: any) => {
		const managerMsgData: IRoomPrivateMsgData = {
			userId: this.managerId,
			msgEvent: event,
			msgData: data,
		};
		this.socket.emit('managerMsg', managerMsgData);

		const broadcastData: IRoomBroadcastData = {
			userIds: Array.from(this.players),
			msgEvent: event,
			msgData: data,
		};
		this.socket.emit('broadcast', broadcastData);
	}

	public NotifyManager = (event: string, data: any) => {
		const managerMsgData: IRoomPrivateMsgData = {
			userId: this.managerId,
			msgEvent: event,
			msgData: data,
		};
		this.socket.emit('managerMsg', managerMsgData);
	}
}
