// Deterministic UUID-shaped identifiers derived from (seed, namespace, key).
// Using a hash instead of a random UUID library keeps generation fully
// reproducible for a given seed while still producing globally-unique-looking
// UUIDv4-shaped strings that Prisma's @db.Uuid columns accept.

import { createHash } from "crypto";

export function deterministicUuid(seed: number, namespace: string, key: string): string {
  const hash = createHash("sha1").update(`railopt:${seed}:${namespace}:${key}`).digest("hex");
  const bytes = hash.slice(0, 32).split("");
  // Set version (4) and variant (8,9,a,b) bits so the string looks like a
  // standard UUIDv4, even though it is deterministically derived.
  bytes[12] = "4";
  const variantNibble = "89ab"[parseInt(bytes[16], 16) % 4];
  bytes[16] = variantNibble;
  const hex = bytes.join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}
