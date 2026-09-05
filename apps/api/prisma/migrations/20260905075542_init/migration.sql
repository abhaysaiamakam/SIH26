-- CreateEnum
CREATE TYPE "Department" AS ENUM ('ENGINEERING', 'TRD', 'S_AND_T');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('TRACK_RENEWAL', 'RAIL_GRINDING', 'BALLAST_CLEANING', 'POINTS_CROSSING_MAINTENANCE', 'BRIDGE_INSPECTION', 'SIGNAL_MAINTENANCE', 'INTERLOCKING_UPGRADE', 'OHE_MAINTENANCE', 'TRACTION_SUBSTATION_MAINTENANCE', 'GENERAL_INSPECTION');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'VERIFIED', 'PRIORITIZED', 'BLOCK_REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IsolationType" AS ENUM ('NONE', 'TRACK_ISOLATION', 'POWER_ISOLATION', 'SIGNAL_ISOLATION', 'FULL_ISOLATION');

-- CreateEnum
CREATE TYPE "PowerRequirement" AS ENUM ('NONE', 'TRACTION_POWER_OFF', 'AUXILIARY_POWER', 'LOW_VOLTAGE');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('MACHINE', 'CREW', 'MATERIAL', 'TOOL');

-- CreateEnum
CREATE TYPE "TrainType" AS ENUM ('PASSENGER', 'EXPRESS', 'GOODS', 'SUBURBAN');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('FIRST_FEASIBLE', 'PRIORITY_FIRST', 'OPTIMIZED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'VALIDATED', 'INVALID', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PlanningRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FIELD_ENGINEER', 'DEPARTMENT_PLANNER', 'DIVISIONAL_PLANNER', 'CONTROL_OPERATOR', 'MANAGEMENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "CandidateRejectionReason" AS ENUM ('INSUFFICIENT_WINDOW_DURATION', 'RESOURCE_UNAVAILABLE', 'CORRIDOR_MISMATCH', 'ISOLATION_MISMATCH', 'POWER_REQUIREMENT_UNAVAILABLE', 'OPERATIONAL_CONFLICT', 'INCOMPATIBLE_WORK_TYPES', 'DEPENDENCY_NOT_FEASIBLE');

-- CreateEnum
CREATE TYPE "ScenarioEventType" AS ENUM ('CORRIDOR_UNAVAILABLE', 'NEW_CRITICAL_REQUEST', 'BLOCK_WINDOW_SHORTENED', 'ADDITIONAL_TRAIN_MOVEMENT', 'TASK_BECOMES_OVERDUE');

-- CreateEnum
CREATE TYPE "ScenarioEventSource" AS ENUM ('SYNTHETIC', 'WHAT_IF');

-- CreateTable
CREATE TABLE "divisions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "divisionId" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridors" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "divisionId" UUID NOT NULL,
    "originStationId" UUID NOT NULL,
    "destinationStationId" UUID NOT NULL,
    "totalLengthKm" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corridors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridor_segments" (
    "id" UUID NOT NULL,
    "corridorId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startChainageKm" DOUBLE PRECISION NOT NULL,
    "endChainageKm" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corridor_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_resources" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "corridorId" UUID,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "corridorId" UUID NOT NULL,
    "segmentId" UUID,
    "criticality" "Criticality" NOT NULL,
    "installDate" TIMESTAMPTZ(6),
    "lastMaintenanceDate" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "assetId" UUID NOT NULL,
    "corridorId" UUID NOT NULL,
    "segmentId" UUID,
    "workType" "WorkType" NOT NULL,
    "description" TEXT NOT NULL,
    "criticality" "Criticality" NOT NULL,
    "urgency" "Criticality" NOT NULL,
    "dueDate" TIMESTAMPTZ(6) NOT NULL,
    "estimatedDurationMinutes" INTEGER NOT NULL,
    "requiredIsolation" "IsolationType" NOT NULL DEFAULT 'NONE',
    "requiredPower" "PowerRequirement" NOT NULL DEFAULT 'NONE',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "requestedById" UUID,
    "scenarioId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_request_resources" (
    "id" UUID NOT NULL,
    "maintenanceRequestId" UUID NOT NULL,
    "trackResourceId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "maintenance_request_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_dependencies" (
    "id" UUID NOT NULL,
    "predecessorId" UUID NOT NULL,
    "successorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_compatibility_rules" (
    "id" UUID NOT NULL,
    "workTypeA" "WorkType" NOT NULL,
    "workTypeB" "WorkType" NOT NULL,
    "department" "Department",
    "compatible" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_compatibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_windows" (
    "id" UUID NOT NULL,
    "corridorId" UUID NOT NULL,
    "segmentId" UUID,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "permittedDepartments" "Department"[],
    "allowsIsolationTypes" "IsolationType"[],
    "allowsPowerTypes" "PowerRequirement"[],
    "maxConcurrentResources" INTEGER,
    "operationalRestrictions" TEXT,
    "scenarioId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_scenarios" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "description" TEXT,
    "divisionId" UUID,
    "configVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_runs" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "strategy" "StrategyType" NOT NULL,
    "status" "PlanningRunStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID,
    "startedAt" TIMESTAMPTZ(6),
    "finishedAt" TIMESTAMPTZ(6),
    "solverStatus" TEXT,
    "objectiveValue" DOUBLE PRECISION,
    "resultPlanId" UUID,
    "errorMessage" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "strategy" "StrategyType" NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "objectiveValue" DOUBLE PRECISION,
    "solverStatus" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_revisions" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "parentRevisionId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_blocks" (
    "id" UUID NOT NULL,
    "planRevisionId" UUID NOT NULL,
    "blockWindowId" UUID NOT NULL,
    "corridorId" UUID NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "department" "Department",
    "isBundle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_tasks" (
    "id" UUID NOT NULL,
    "planRevisionId" UUID NOT NULL,
    "planBlockId" UUID,
    "maintenanceRequestId" UUID NOT NULL,
    "scheduled" BOOLEAN NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "priorityBreakdown" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "rejectionReason" "CandidateRejectionReason",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "train_movements" (
    "id" UUID NOT NULL,
    "trainNumber" TEXT NOT NULL,
    "trainType" "TrainType" NOT NULL,
    "corridorId" UUID NOT NULL,
    "segmentId" UUID,
    "trackResourceId" UUID,
    "scheduledStart" TIMESTAMPTZ(6) NOT NULL,
    "scheduledEnd" TIMESTAMPTZ(6) NOT NULL,
    "priority" INTEGER NOT NULL,
    "scenarioId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "train_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_events" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "eventType" "ScenarioEventType" NOT NULL,
    "source" "ScenarioEventSource" NOT NULL DEFAULT 'SYNTHETIC',
    "payload" JSONB NOT NULL,
    "appliedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" UUID NOT NULL,
    "planRevisionId" UUID NOT NULL,
    "scenarioEventId" UUID,
    "impactedTrainCount" INTEGER NOT NULL,
    "totalDelayMinutes" INTEGER NOT NULL,
    "affectedMovements" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL,
    "blockUtilization" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_runs" (
    "id" UUID NOT NULL,
    "planRevisionId" UUID NOT NULL,
    "status" "ValidationStatus" NOT NULL,
    "violations" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL,
    "planRevisionId" UUID NOT NULL,
    "decidedById" UUID NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "divisionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "correlationId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "divisions_code_key" ON "divisions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "stations_code_key" ON "stations"("code");

-- CreateIndex
CREATE INDEX "stations_divisionId_idx" ON "stations"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "corridors_code_key" ON "corridors"("code");

-- CreateIndex
CREATE INDEX "corridors_divisionId_idx" ON "corridors"("divisionId");

-- CreateIndex
CREATE INDEX "corridor_segments_corridorId_idx" ON "corridor_segments"("corridorId");

-- CreateIndex
CREATE UNIQUE INDEX "corridor_segments_corridorId_sequenceNumber_key" ON "corridor_segments"("corridorId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "track_resources_code_key" ON "track_resources"("code");

-- CreateIndex
CREATE INDEX "track_resources_corridorId_idx" ON "track_resources"("corridorId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE INDEX "assets_corridorId_idx" ON "assets"("corridorId");

-- CreateIndex
CREATE INDEX "assets_criticality_idx" ON "assets"("criticality");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_requestNumber_key" ON "maintenance_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "maintenance_requests_corridorId_idx" ON "maintenance_requests"("corridorId");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_dueDate_idx" ON "maintenance_requests"("dueDate");

-- CreateIndex
CREATE INDEX "maintenance_requests_scenarioId_idx" ON "maintenance_requests"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_request_resources_maintenanceRequestId_trackRes_key" ON "maintenance_request_resources"("maintenanceRequestId", "trackResourceId");

-- CreateIndex
CREATE UNIQUE INDEX "request_dependencies_predecessorId_successorId_key" ON "request_dependencies"("predecessorId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "task_compatibility_rules_workTypeA_workTypeB_department_key" ON "task_compatibility_rules"("workTypeA", "workTypeB", "department");

-- CreateIndex
CREATE INDEX "block_windows_corridorId_idx" ON "block_windows"("corridorId");

-- CreateIndex
CREATE INDEX "block_windows_scenarioId_idx" ON "block_windows"("scenarioId");

-- CreateIndex
CREATE INDEX "block_windows_startTime_endTime_idx" ON "block_windows"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "planning_scenarios_seed_idx" ON "planning_scenarios"("seed");

-- CreateIndex
CREATE UNIQUE INDEX "planning_runs_resultPlanId_key" ON "planning_runs"("resultPlanId");

-- CreateIndex
CREATE INDEX "planning_runs_scenarioId_strategy_idx" ON "planning_runs"("scenarioId", "strategy");

-- CreateIndex
CREATE INDEX "planning_runs_status_idx" ON "planning_runs"("status");

-- CreateIndex
CREATE INDEX "plans_scenarioId_idx" ON "plans"("scenarioId");

-- CreateIndex
CREATE INDEX "plans_status_idx" ON "plans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_revisions_planId_revisionNumber_key" ON "plan_revisions"("planId", "revisionNumber");

-- CreateIndex
CREATE INDEX "plan_blocks_planRevisionId_idx" ON "plan_blocks"("planRevisionId");

-- CreateIndex
CREATE INDEX "plan_blocks_blockWindowId_idx" ON "plan_blocks"("blockWindowId");

-- CreateIndex
CREATE INDEX "plan_tasks_planBlockId_idx" ON "plan_tasks"("planBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_tasks_planRevisionId_maintenanceRequestId_key" ON "plan_tasks"("planRevisionId", "maintenanceRequestId");

-- CreateIndex
CREATE INDEX "train_movements_corridorId_scheduledStart_scheduledEnd_idx" ON "train_movements"("corridorId", "scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE INDEX "train_movements_scenarioId_idx" ON "train_movements"("scenarioId");

-- CreateIndex
CREATE INDEX "scenario_events_scenarioId_idx" ON "scenario_events"("scenarioId");

-- CreateIndex
CREATE INDEX "simulation_runs_planRevisionId_idx" ON "simulation_runs"("planRevisionId");

-- CreateIndex
CREATE INDEX "validation_runs_planRevisionId_idx" ON "validation_runs"("planRevisionId");

-- CreateIndex
CREATE INDEX "approval_decisions_planRevisionId_idx" ON "approval_decisions"("planRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_userId_role_divisionId_key" ON "role_assignments"("userId", "role", "divisionId");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_originStationId_fkey" FOREIGN KEY ("originStationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_destinationStationId_fkey" FOREIGN KEY ("destinationStationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridor_segments" ADD CONSTRAINT "corridor_segments_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_resources" ADD CONSTRAINT "track_resources_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "corridor_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "corridor_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "planning_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request_resources" ADD CONSTRAINT "maintenance_request_resources_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request_resources" ADD CONSTRAINT "maintenance_request_resources_trackResourceId_fkey" FOREIGN KEY ("trackResourceId") REFERENCES "track_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_dependencies" ADD CONSTRAINT "request_dependencies_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_dependencies" ADD CONSTRAINT "request_dependencies_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_windows" ADD CONSTRAINT "block_windows_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_windows" ADD CONSTRAINT "block_windows_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "corridor_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_windows" ADD CONSTRAINT "block_windows_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "planning_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "planning_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_resultPlanId_fkey" FOREIGN KEY ("resultPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "planning_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_revisions" ADD CONSTRAINT "plan_revisions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_blockWindowId_fkey" FOREIGN KEY ("blockWindowId") REFERENCES "block_windows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_planBlockId_fkey" FOREIGN KEY ("planBlockId") REFERENCES "plan_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_movements" ADD CONSTRAINT "train_movements_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_movements" ADD CONSTRAINT "train_movements_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "corridor_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_movements" ADD CONSTRAINT "train_movements_trackResourceId_fkey" FOREIGN KEY ("trackResourceId") REFERENCES "track_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_movements" ADD CONSTRAINT "train_movements_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "planning_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_events" ADD CONSTRAINT "scenario_events_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "planning_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
