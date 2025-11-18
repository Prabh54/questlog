export interface EntryCursor {
  completedAt: Date;
  id: string;
}

interface SerializedCursor {
  completedAt: string;
  id: string;
}

export function encodeCursor(cursor: EntryCursor): string {
  const payload: SerializedCursor = {
    completedAt: cursor.completedAt.toISOString(),
    id: cursor.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

export function decodeCursor(raw: string): EntryCursor | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as Partial<SerializedCursor>;
    if (typeof parsed.completedAt !== 'string' || typeof parsed.id !== 'string') return null;
    const completedAt = new Date(parsed.completedAt);
    if (Number.isNaN(completedAt.getTime())) return null;
    return { completedAt, id: parsed.id };
  } catch {
    return null;
  }
}
