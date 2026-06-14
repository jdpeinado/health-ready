// Progress values are normalized to kg by converting lb (× 0.45359237), which
// produces float noise like 11.793401620000001. Round display values to one
// decimal — gym plates step by 0.5 kg, so one decimal is plenty of precision.
// (Rounded at the display boundary only; stored/aggregated values keep full
// precision so volume = load × reps doesn't accumulate rounding error.)
export function roundKg(kg: number): number {
  return Math.round(kg * 10) / 10;
}
