import {
  SessionRepository,
  SessionState,
  SessionStateSchema,
  Result,
  success,
  failure,
} from '@dolmenwood/core';
import fs from 'fs/promises';
import path from 'path';

export class JsonSessionRepository implements SessionRepository {
  constructor(private storageDir: string) {}

  private getFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.json`);
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  async save(session: SessionState): Promise<Result<void>> {
    try {
      await this.ensureDir();
      const filePath = this.getFilePath(session.id);
      const data = JSON.stringify(session, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async load(sessionId: string): Promise<Result<SessionState>> {
    try {
      const filePath = this.getFilePath(sessionId);
      const content = await fs.readFile(filePath, 'utf-8');
      const raw = JSON.parse(content);
      const session = SessionStateSchema.parse(raw);
      return success(session);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async list(): Promise<Result<SessionState[]>> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.storageDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const sessions: SessionState[] = [];
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.storageDir, file),
            'utf-8',
          );
          const raw = JSON.parse(content);
          const session = SessionStateSchema.parse(raw);
          sessions.push(session);
        } catch (e) {
          console.warn(`Skipping invalid session file ${file}:`, e);
        }
      }

      // Sort by updatedAt desc
      sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      return success(sessions);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async loadLatest(): Promise<Result<SessionState>> {
    const listRes = await this.list();
    if (listRes.kind === 'failure') return listRes;

    if (listRes.data.length === 0) {
      return failure(new Error('No sessions found'));
    }

    return success(listRes.data[0]);
  }
}
