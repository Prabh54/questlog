import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError, Errors } from '../lib/errors';
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from '../validators/category.validators';

export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { quests: true } } },
  });
}

export async function createCategory(userId: string, body: CreateCategoryBody) {
  try {
    return await prisma.category.create({
      data: {
        userId,
        name: body.name,
        description: body.description ?? null,
        color: body.color ?? '#6366f1',
        icon: body.icon ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CATEGORY_NAME_TAKEN', 409, 'A category with that name already exists');
    }
    throw err;
  }
}

export async function updateCategory(
  categoryId: string,
  userId: string,
  body: UpdateCategoryBody,
) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing || existing.userId !== userId) throw Errors.notFound('Category');

  try {
    return await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: body.name ?? undefined,
        description: body.description === undefined ? undefined : body.description,
        color: body.color ?? undefined,
        icon: body.icon === undefined ? undefined : body.icon,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CATEGORY_NAME_TAKEN', 409, 'A category with that name already exists');
    }
    throw err;
  }
}

export async function deleteCategory(categoryId: string, userId: string) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing || existing.userId !== userId) throw Errors.notFound('Category');

  await prisma.category.delete({ where: { id: categoryId } });
}
