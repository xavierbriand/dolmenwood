import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from './SessionService.js';
import { SessionRepository } from '../ports/SessionRepository.js';
import { success } from '../utils/Result.js';

const mockRepo = {
  save: vi.fn(),
  load: vi.fn(),
  loadLatest: vi.fn(),
  list: vi.fn(),
} as unknown as SessionRepository;

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService(mockRepo);
    vi.resetAllMocks();
  });

  it('creates a new session with defaults', async () => {
    mockRepo.save = vi.fn().mockResolvedValue(success(undefined));

    const res = await service.createSession();

    expect(res.kind).toBe('success');
    if (res.kind === 'success') {
      expect(res.data.id).toBeDefined();
      expect(res.data.context.partyLevel).toBe(1);
      expect(res.data.history).toEqual([]);
      expect(mockRepo.save).toHaveBeenCalledWith(res.data);
    }
  });

  it('creates a session with custom context', async () => {
    mockRepo.save = vi.fn().mockResolvedValue(success(undefined));

    const res = await service.createSession({
      partyLevel: 3,
      timeOfDay: 'Night',
    });

    expect(res.kind).toBe('success');
    if (res.kind === 'success') {
      expect(res.data.context.partyLevel).toBe(3);
      expect(res.data.context.timeOfDay).toBe('Night');
    }
  });
});
