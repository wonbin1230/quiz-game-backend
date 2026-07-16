export type SocketErrorPayload = {
  event: string;
  message: string;
  code?: string;
};

export const SocketErrorCode = {
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  LOCKED: 'LOCKED',
  INVALID_STATE: 'INVALID_STATE',
} as const;

export type SocketErrorCodeValue = (typeof SocketErrorCode)[keyof typeof SocketErrorCode];

export class AppError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}
