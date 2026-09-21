import { DistanceConstraint } from "./DistanceConstraint";

/**
 * Bending stiffness approximated by soft distance constraints between
 * second-neighbour particles (i-1, i+1) held near 2*segmentLength.
 * The constraint can only pull — it straightens the rope when it folds,
 * which is exactly what bending stiffness does.
 */
export function buildBendingConstraints(
  count: number,
  segmentLength: number,
  compliance: number,
): DistanceConstraint[] {
  const out: DistanceConstraint[] = [];
  for (let i = 1; i + 1 < count; i++) {
    out.push(new DistanceConstraint(i - 1, i + 1, 2 * segmentLength, compliance));
  }
  return out;
}
