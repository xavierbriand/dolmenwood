export type Result<T, E = Error> = 
  | { kind: 'success'; data: T }
  | { kind: 'failure'; error: E };

export const success = <T>(data: T): Result<T, never> => ({ kind: 'success', data });
export const failure = <E>(error: E): Result<never, E> => ({ kind: 'failure', error });
