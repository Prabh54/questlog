import { prisma } from '../../db/prisma';

export async function cleanDb() {
  await prisma.questEntry.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
