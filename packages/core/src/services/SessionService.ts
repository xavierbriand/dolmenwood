import { SessionRepository } from '../ports/SessionRepository.js';
import { SessionState, SessionContext } from '../schemas/session.js';
import { Encounter } from '../schemas/encounter.js';
import { Result, success, failure } from '../utils/Result.js';

export class SessionService {
  constructor(private repo: SessionRepository) {}

  async createSession(
    context?: Partial<SessionContext>,
  ): Promise<Result<SessionState>> {
    const now = new Date().toISOString();
    const session: SessionState = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      context: {
        partyLevel: context?.partyLevel ?? 1,
        timeOfDay: context?.timeOfDay ?? 'Day',
        currentRegionId: context?.currentRegionId,
      },
      history: [],
    };

    const res = await this.repo.save(session);
    if (res.kind === 'failure') return res;

    return success(session);
  }

  async addEncounter(
    sessionId: string,
    encounter: Encounter,
    regionId: string,
  ): Promise<Result<SessionState>> {
    const loadRes = await this.repo.load(sessionId);
    if (loadRes.kind === 'failure') return loadRes;

    const session = loadRes.data;
    const now = new Date().toISOString();

    session.history.push({
      id: crypto.randomUUID(),
      timestamp: now,
      encounter,
      regionId,
    });
    session.updatedAt = now;

    // Update context to match the encounter context if logical
    session.context.currentRegionId = regionId;

    const saveRes = await this.repo.save(session);
    if (saveRes.kind === 'failure') return saveRes;

    return success(session);
  }

  async updateContext(
    sessionId: string,
    contextUpdates: Partial<SessionContext>,
  ): Promise<Result<SessionState>> {
    const loadRes = await this.repo.load(sessionId);
    if (loadRes.kind === 'failure') return loadRes;

    const session = loadRes.data;
    session.context = { ...session.context, ...contextUpdates };
    session.updatedAt = new Date().toISOString();

    const saveRes = await this.repo.save(session);
    if (saveRes.kind === 'failure') return saveRes;

    return success(session);
  }

  async getSession(sessionId: string): Promise<Result<SessionState>> {
    return this.repo.load(sessionId);
  }

  async getLatestSession(): Promise<Result<SessionState>> {
    return this.repo.loadLatest();
  }

  async listSessions(): Promise<Result<SessionState[]>> {
    return this.repo.list();
  }
}
