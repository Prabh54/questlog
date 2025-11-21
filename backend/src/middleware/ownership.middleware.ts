import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { Errors } from '../lib/errors';

type ResourceType = 'quest' | 'category' | 'questEntry';

export const ownershipMiddleware =
  (resourceType: ResourceType) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    try {
      if (resourceType === 'quest') {
        const resource = await prisma.quest.findUnique({ where: { id } });
        if (!resource || resource.userId !== userId) {
          next(Errors.notFound('Quest'));
          return;
        }
        req.resource = resource;
      } else if (resourceType === 'category') {
        const resource = await prisma.category.findUnique({ where: { id } });
        if (!resource || resource.userId !== userId) {
          next(Errors.notFound('Category'));
          return;
        }
        req.resource = resource;
      } else if (resourceType === 'questEntry') {
        const resource = await prisma.questEntry.findUnique({ where: { id } });
        if (!resource || resource.userId !== userId) {
          next(Errors.notFound('Quest entry'));
          return;
        }
        req.resource = resource;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
