import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { ProgressSummaryItem } from "../../api/types";

const AMBER = "#f0923c";

// A compact preview: name + headline number + a tiny axis-less sparkline.
// Clicking selects the exercise so the full detail chart renders below.
export function SparklineCard({
  item,
  selected,
  onClick,
}: {
  item: ProgressSummaryItem;
  selected: boolean;
  onClick: () => void;
}) {
  const gradientId = `spark-${item.exerciseId}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col gap-2 rounded-2xl border bg-card/60 p-3 text-left transition-colors hover:bg-card ${
        selected ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">
          {item.name}
        </div>
        <div className="font-mono text-lg font-bold tabular-nums">
          {item.latest}
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            {item.unit}
          </span>
        </div>
      </div>
      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={item.points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AMBER} stopOpacity={0.3} />
                <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={AMBER}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
}
