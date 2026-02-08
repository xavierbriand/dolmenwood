import { Result } from '../utils/Result.js';
import { SessionState } from '../schemas/session.js';

export interface SessionRepository {
  save(session: SessionState): Promise<Result<void>>;
  load(sessionId: string): Promise<Result<SessionState>>;
  loadLatest(): Promise<Result<SessionState>>; // Returns failure if no sessions exist
  list(): Promise<Result<SessionState[]>>;
}
