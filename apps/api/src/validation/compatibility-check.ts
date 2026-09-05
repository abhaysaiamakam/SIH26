import { CompatibilityDefaultsV1 } from "@railopt/config";

/** Independent re-implementation of the same compatibility rule precedence
 * as services/optimizer/src/core/compatibility_engine.py (explicit DB rule
 * > hard incompatible pairs > same-department rules/default > cross-
 * department allow-list/default) - written fresh in TypeScript, sharing no
 * code with the Python solver, so the validator is genuinely independent. */

interface TaskLike {
  department: string;
  workType: string;
}

interface RuleLike {
  workTypeA: string;
  workTypeB: string;
  department: string | null;
  compatible: boolean;
}

function pairMatches(a: string, b: string, x: string, y: string): boolean {
  return (a === x && b === y) || (a === y && b === x);
}

export function areWorkTypesCompatible(
  taskA: TaskLike,
  taskB: TaskLike,
  rules: RuleLike[],
  defaults: CompatibilityDefaultsV1,
): boolean {
  const explicit = rules.find(
    (r) =>
      pairMatches(r.workTypeA, r.workTypeB, taskA.workType, taskB.workType) &&
      (r.department === null || (taskA.department === r.department && taskB.department === r.department)),
  );
  if (explicit) return explicit.compatible;

  const hardIncompatible = defaults.hardIncompatiblePairs.some((p) =>
    pairMatches(p.workTypeA, p.workTypeB, taskA.workType, taskB.workType),
  );
  if (hardIncompatible) return false;

  if (taskA.department === taskB.department) {
    const sameDeptIncompatible = defaults.sameDepartmentIncompatiblePairs.some((p) =>
      pairMatches(p.workTypeA, p.workTypeB, taskA.workType, taskB.workType),
    );
    if (sameDeptIncompatible) return false;
    return defaults.sameDepartmentDefaultCompatible;
  }

  const crossDeptAllowed = defaults.crossDepartmentAllowList.some((p) =>
    pairMatches(p.workTypeA, p.workTypeB, taskA.workType, taskB.workType),
  );
  if (crossDeptAllowed) return true;
  return defaults.crossDepartmentDefaultCompatible;
}
