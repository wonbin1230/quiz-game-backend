import AsyncLock from 'async-lock';
import { UserContext } from '../socket/user/UserContext';
import { ManagerContext } from '../socket/manager/ManagerContext';
import { EventLockAttemptProceed, EventLockSetUnlock } from '../utils/rate-limit';
import { ContextBase } from '../socket/ContextBase';

export abstract class ControllerBase<T extends ContextBase> {
  context: T;
  name: string;
  eventLocks: AsyncLock = new AsyncLock();

  constructor(context: T, name: string) {
    this.context = context;
    this.name = name;
  }

  abstract EventRegisters(): void;

  EmitSuccessResponse = (event: string, data: any) => {
    this.context.EmitSuccessResponse(`${this.name}:${event}`, data);
  }

  EmitFailResponse = (event: string, error: any) => {
    this.context.EmitFailResponse(`${this.name}:${event}`, error);
  }

  EventRegister = (event: string, handler: (...args: any[]) => Promise<void>): void => {
    this.context.socket.on(event, this.LockHandler(event, handler));
  }

  LockHandler = (event: string, handler: (...args: any[]) => Promise<void>): (...args: any[]) => Promise<void> => {
    return async (...args: any[]) => {
      try {
        EventLockAttemptProceed(this.context.socket.id, `${this.name}:${event}`);
        await this.eventLocks.acquire(event, async () => {
          await handler(...args);
        })
      } catch (error: any) {
        //
      } finally {
        EventLockSetUnlock(this.context.socket.id, `${this.name}:${event}`);
      }
    }
  }
}