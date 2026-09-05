// Fixed reference network topology (divisions, stations, corridors,
// segments). The topology itself (station/corridor codes and counts) is
// kept stable across seeds so a demo can always say "corridor C-03" and
// mean the same physical corridor - only IDs and the operational demand
// generated on top of it (assets, maintenance, trains, windows) vary by
// seed. All station names and coordinates are synthetic (ICAO-alphabet
// placeholder names on a fictitious grid) and do not correspond to any
// real Indian Railways geography.

import { deterministicUuid } from "./ids";
import { GenCorridor, GenCorridorSegment, GenDivision, GenStation } from "./types";

const CD_STATION_NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo",
];
const WD_STATION_NAMES = [
  "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey",
];

interface CorridorSpec {
  code: string;
  name: string;
  division: "CD" | "WD";
  originName: string;
  destinationName: string;
  totalLengthKm: number;
  segmentCount: number;
}

const CORRIDOR_SPECS: CorridorSpec[] = [
  { code: "C-01", name: "Alpha - Delta Main Line", division: "CD", originName: "Alpha", destinationName: "Delta", totalLengthKm: 120, segmentCount: 3 },
  { code: "C-02", name: "Delta - Golf Line", division: "CD", originName: "Delta", destinationName: "Golf", totalLengthKm: 95, segmentCount: 3 },
  { code: "C-03", name: "Golf - Kilo Trunk Route", division: "CD", originName: "Golf", destinationName: "Kilo", totalLengthKm: 150, segmentCount: 4 },
  { code: "C-04", name: "Mike - Papa Main Line", division: "WD", originName: "Mike", destinationName: "Papa", totalLengthKm: 110, segmentCount: 3 },
  { code: "C-05", name: "Papa - Sierra Line", division: "WD", originName: "Papa", destinationName: "Sierra", totalLengthKm: 90, segmentCount: 3 },
  { code: "C-06", name: "Sierra - Whiskey Trunk Route", division: "WD", originName: "Sierra", destinationName: "Whiskey", totalLengthKm: 140, segmentCount: 4 },
];

export interface NetworkResult {
  divisions: GenDivision[];
  stations: GenStation[];
  corridors: GenCorridor[];
  segments: GenCorridorSegment[];
}

export function buildNetwork(seed: number): NetworkResult {
  const divisions: GenDivision[] = [
    { id: deterministicUuid(seed, "division", "CD"), code: "CD", name: "Central Division (synthetic)" },
    { id: deterministicUuid(seed, "division", "WD"), code: "WD", name: "Western Division (synthetic)" },
  ];
  const divisionByCode = new Map(divisions.map((d) => [d.code, d]));

  const stations: GenStation[] = [];
  const stationIdByName = new Map<string, string>();

  const addStations = (names: string[], divisionCode: "CD" | "WD", latBase: number, lngBase: number) => {
    names.forEach((name, index) => {
      const id = deterministicUuid(seed, "station", name);
      stationIdByName.set(name, id);
      stations.push({
        id,
        code: `${divisionCode}-ST${String(index + 1).padStart(2, "0")}`,
        name: `${name} Junction (synthetic)`,
        divisionId: divisionByCode.get(divisionCode)!.id,
        latitude: Number((latBase + index * 0.22).toFixed(4)),
        longitude: Number((lngBase + index * 0.31).toFixed(4)),
      });
    });
  };

  addStations(CD_STATION_NAMES, "CD", 21.0, 78.0);
  addStations(WD_STATION_NAMES, "WD", 19.0, 72.5);

  const corridors: GenCorridor[] = [];
  const segments: GenCorridorSegment[] = [];

  for (const spec of CORRIDOR_SPECS) {
    const corridorId = deterministicUuid(seed, "corridor", spec.code);
    corridors.push({
      id: corridorId,
      code: spec.code,
      name: spec.name,
      divisionId: divisionByCode.get(spec.division)!.id,
      originStationId: stationIdByName.get(spec.originName)!,
      destinationStationId: stationIdByName.get(spec.destinationName)!,
      totalLengthKm: spec.totalLengthKm,
    });

    const segmentLength = spec.totalLengthKm / spec.segmentCount;
    for (let i = 0; i < spec.segmentCount; i++) {
      segments.push({
        id: deterministicUuid(seed, "segment", `${spec.code}-${i + 1}`),
        corridorId,
        sequenceNumber: i + 1,
        name: `${spec.code} Segment ${i + 1}`,
        startChainageKm: Number((i * segmentLength).toFixed(2)),
        endChainageKm: Number(((i + 1) * segmentLength).toFixed(2)),
      });
    }
  }

  return { divisions, stations, corridors, segments };
}
