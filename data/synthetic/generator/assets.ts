import { deterministicUuid } from "./ids";
import { SeededRng } from "./rng";
import { GenAsset, GenCorridor, GenCorridorSegment } from "./types";

const ASSET_TYPES = [
  "RAIL",
  "BALLAST_BED",
  "POINTS_AND_CROSSING",
  "BRIDGE",
  "OHE_MAST",
  "TRACTION_SUBSTATION",
  "SIGNAL_INTERLOCKING",
  "TRACK_CIRCUIT",
] as const;

const CRITICALITY_WEIGHTS: { value: GenAsset["criticality"]; weight: number }[] = [
  { value: "LOW", weight: 25 },
  { value: "MEDIUM", weight: 35 },
  { value: "HIGH", weight: 25 },
  { value: "CRITICAL", weight: 15 },
];

function pickCriticality(rng: SeededRng): GenAsset["criticality"] {
  const total = CRITICALITY_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng.float(0, total);
  for (const w of CRITICALITY_WEIGHTS) {
    if (roll < w.weight) return w.value;
    roll -= w.weight;
  }
  return "MEDIUM";
}

const GENERATED_AT = new Date("2026-09-05T00:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(GENERATED_AT.getTime() - days * 86_400_000).toISOString();
}

export function buildAssets(
  seed: number,
  corridors: GenCorridor[],
  segments: GenCorridorSegment[],
): GenAsset[] {
  const rng = new SeededRng(seed + 1001);
  const assets: GenAsset[] = [];
  let assetSeq = 0;

  for (const corridor of corridors) {
    const corridorSegments = segments.filter((s) => s.corridorId === corridor.id);
    let seqInCorridor = 0;

    const addAsset = (assetType: (typeof ASSET_TYPES)[number]) => {
      assetSeq += 1;
      seqInCorridor += 1;
      const segment = corridorSegments.length > 0 ? rng.pick(corridorSegments) : null;
      const criticality = pickCriticality(rng);
      const installDate = daysAgo(rng.int(365, 365 * 12));
      const hasBeenMaintained = rng.chance(0.75);

      assets.push({
        id: deterministicUuid(seed, "asset", `${corridor.code}-${assetSeq}`),
        code: `AST-${corridor.code}-${String(seqInCorridor).padStart(2, "0")}`,
        name: `${corridor.code} ${assetType.replace(/_/g, " ")} #${seqInCorridor}`,
        assetType,
        corridorId: corridor.id,
        segmentId: segment ? segment.id : null,
        criticality,
        installDate,
        lastMaintenanceDate: hasBeenMaintained ? daysAgo(rng.int(30, 700)) : null,
      });
    };

    // Guarantee every corridor has at least one asset of every type, so
    // the engineered maintenance scenarios in maintenance.ts (which look
    // up a specific asset type on a specific corridor) always find one
    // regardless of seed.
    for (const assetType of ASSET_TYPES) {
      addAsset(assetType);
    }
    // A little extra volume/variety per corridor.
    const extraCount = rng.int(0, 2);
    for (let i = 0; i < extraCount; i++) {
      addAsset(rng.pick(ASSET_TYPES));
    }
  }

  // Guarantee a credible minimum of CRITICAL assets network-wide (the
  // priority engine and the overdue-critical demo scenario depend on
  // there being several) regardless of how the weighted roll landed.
  const criticalCount = assets.filter((a) => a.criticality === "CRITICAL").length;
  const minCritical = 5;
  if (criticalCount < minCritical) {
    const upgradeCandidates = assets.filter((a) => a.criticality !== "CRITICAL");
    const toUpgrade = rng.shuffle(upgradeCandidates).slice(0, minCritical - criticalCount);
    for (const asset of toUpgrade) {
      asset.criticality = "CRITICAL";
    }
  }

  return assets;
}
