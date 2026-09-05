// Deterministic synthetic railway scenario generator.
// Full implementation lands in Phase 2 - see docs/PROJECT_SPEC.md for scale
// targets and packages/config for the versioned weights consumed here.

export function placeholder(): string {
  return "railopt synthetic data generator scaffolded - see Phase 2";
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log(placeholder());
}
