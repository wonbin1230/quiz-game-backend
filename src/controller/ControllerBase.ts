import AsyncLock from 'async-lock';
import { UserContext } from '../socket/user/UserContext';
import { EventLockAttemptProceed, EventLockSetUnlock } from '../utils/rate-limit';

export abstract class ControllerBase {
  systemName: string;
  context: UserContext;
  eventLocks: AsyncLock = new AsyncLock();

  constructor(context: UserContext, systemName: string) {
    this.context = context;
    this.systemName = systemName;
  }

  abstract EventRegisters(): void;

  EmitSuccessResponse = (event: string, data: any) => {
    this.context.EmitSuccessResponse(`${this.systemName}:${event}`, data);
  }

  EmitFailResponse = (event: string, error: any) => {
    this.context.EmitFailResponse(`${this.systemName}:${event}`, error);
  }

  EventRegister = (event: string, handler: (...args: any[]) => Promise<void>): void => {
    this.context.socket.on(event, this.LockHandler(event, handler));
  }

  LockHandler = (event: string, handler: (...args: any[]) => Promise<void>): (...args: any[]) => Promise<void> => {
    return async (...args: any[]) => {
      try {
        EventLockAttemptProceed(this.context.socket.id, `${this.systemName}:${event}`);
        await this.eventLocks.acquire(event, async () => {
          await handler(...args);
        })
      } catch (error: any) {
        //
      } finally {
        EventLockSetUnlock(this.context.socket.id, `${this.systemName}:${event}`);
      }
    }
  }
}