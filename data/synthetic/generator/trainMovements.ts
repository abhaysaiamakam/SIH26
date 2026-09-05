// Train movements: a realistic daytime passenger/express pattern per
// corridor, plus overnight goods trains - one of which is deliberately
// scheduled to overlap each corridor's first standard block window, so the
// simulator has real (soft) operational conflicts and delay minutes to
// compute rather than a traffic-free network.

import { deterministicUuid } from "./ids";
import { SeededRng } from "./rng";
import { GenBlockWindow, GenCorridor, GenTrainMovement } from "./types";

const GENERATED_AT = new Date("2026-09-05T00:00:00.000Z");
function atOffset(days: number, hour: number, minute = 0): string {
  const d = new Date(GENERATED_AT.getTime() + days * 86_400_000);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

const PRIORITY_BY_TYPE: Record<GenTrainMovement["trainType"], number> = {
  EXPRESS: 9,
  PASSENGER: 7,
  SUBURBAN: 6,
  GOODS: 3,
};

export function buildTrainMovements(
  seed: number,
  corridors: GenCorridor[],
  blockWindows: GenBlockWindow[],
): GenTrainMovement[] {
  const rng = new SeededRng(seed + 3003);
  const movements: GenTrainMovement[] = [];
  let numberSeq = 10001;

  const push = (
    corridor: GenCorridor,
    trainType: GenTrainMovement["trainType"],
    scheduledStart: string,
    durationMinutes: number,
  ) => {
    numberSeq += 1;
    movements.push({
      id: deterministicUuid(seed, "train", `${corridor.code}-${numberSeq}`),
      trainNumber: String(numberSeq),
      trainType,
      corridorId: corridor.id,
      segmentId: null,
      trackResourceId: null,
      scheduledStart,
      scheduledEnd: plusMinutes(scheduledStart, durationMinutes),
      priority: PRIORITY_BY_TYPE[trainType],
    });
  };

  for (const corridor of corridors) {
    const dayOffset = rng.int(1, 5);

    // Daytime passenger service.
    push(corridor, "PASSENGER", atOffset(dayOffset, rng.int(6, 9), rng.int(0, 59)), rng.int(90, 180));
    push(corridor, "PASSENGER", atOffset(dayOffset, rng.int(16, 19), rng.int(0, 59)), rng.int(90, 180));

    // One express service.
    push(corridor, "EXPRESS", atOffset(dayOffset, rng.int(10, 14), rng.int(0, 59)), rng.int(60, 120));

    // One unconstrained overnight goods service (no deliberate overlap).
    push(corridor, "GOODS", atOffset(dayOffset + 2, rng.int(20, 23), rng.int(0, 59)), rng.int(120, 240));

    // One goods service deliberately overlapping this corridor's first
    // standard block window, to give the simulator a real conflict.
    const firstStandardWindow = blockWindows.find(
      (w) => w.corridorId === corridor.id && w.durationMinutes === 240 && w.permittedDepartments.length === 3,
    );
    if (firstStandardWindow) {
      const overlapStart = plusMinutes(firstStandardWindow.startTime, -30);
      push(corridor, "GOODS", overlapStart, 90);
    } else {
      push(corridor, "GOODS", atOffset(dayOffset + 3, rng.int(0, 4)), 90);
    }
  }

  return movements;
}
