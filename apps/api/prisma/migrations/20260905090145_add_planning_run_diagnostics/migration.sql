-- AlterTable
ALTER TABLE "planning_runs" ADD COLUMN     "candidateCount" INTEGER,
ADD COLUMN     "feasibleCandidateCount" INTEGER,
ADD COLUMN     "rejectedCandidateCount" INTEGER,
ADD COLUMN     "solveTimeMs" INTEGER;
