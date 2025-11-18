import { Category, Quest, QuestEntry } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      resource?: Quest | Category | QuestEntry;
    }
  }
}

export {};
