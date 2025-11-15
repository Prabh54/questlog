-- CreateEnum
CREATE TYPE "QuestFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "quests" ADD COLUMN "frequency" "QuestFrequency" NOT NULL DEFAULT 'DAILY';
