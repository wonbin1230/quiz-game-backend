import AsyncLock from 'async-lock';
import { EventLockAttemptProceed, EventLockSetUnlock } from '../utils/rate-limit';
import { ContextBase } from '../socket/ContextBase';

export type EventHandler<TData = any> = (data: TData) => Promise<void>;

export type EventMiddleware<TContext extends ContextBase = ContextBase, TData = any, TNext = TData> = (
  data: TData,
  context: TContext,
) => Promise<TNext | void> | TNext | void;

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

  EventRegister = <TData = any>(
    event: string,
    handler: EventHandler<TData>,
    middlewares: EventMiddleware<T, any, any>[] = [],
  ): void => {
    const responseEvent = event.startsWith(`${this.name}:`)
      ? event.slice(this.name.length + 1)
      : event;

    this.context.socket.on(event, this.LockHandler(event, async (data) => {
      try {
        let payload: any = data;
        for (const middleware of middlewares) {
          const result = await middleware(payload, this.context);
          if (result !== undefined) {
            payload = result;
          }
        }
        await handler(payload);
      } catch (error: any) {
        this.EmitFailResponse(responseEvent, error);
      }
    }));
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
