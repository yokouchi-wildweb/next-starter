// src/features/core/admin/dashboard/components/parts/DeveloperMotivationChart.tsx

interface DeveloperMotivationChartProps {
  percentage: number;
}

const RADIUS = 60;
const STROKE = 20;
const START_ANGLE = 210;
const ANGLE_RANGE = 300;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const a = (angle - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function getGradientColors(): [string, string] {
  return [
    "color-mix(in oklch, var(--color-primary) 70%, var(--color-card))",
    "var(--color-primary)",
  ];
}

function getMotivationMessage(percentage: number): string {
  if (percentage < 20) return "System Shutdown";
  if (percentage < 40) return "Existential Slump";
  if (percentage < 60) return "Lazy Sunday Mode";
  if (percentage < 80) return "Normal Flow";
  if (percentage < 120) return "Solid Motivation";
  if (percentage < 150) return "Productivity Overdrive";
  if (percentage < 180) return "The Highest Motivation";
  return "Transcendent Mode";
}

export function DeveloperMotivationChart({ percentage }: DeveloperMotivationChartProps) {
  const clamped = Math.min(Math.max(percentage, 0), 200);
  const progress = clamped / 200;
  const progressEnd = START_ANGLE + ANGLE_RANGE * progress;
  const size = (RADIUS + STROKE) * 2;

  const [startColor, endColor] = getGradientColors();
  const message = getMotivationMessage(clamped);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="motivationGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
        <path
          d={arcPath(RADIUS + STROKE, RADIUS + STROKE, RADIUS, START_ANGLE, START_ANGLE + ANGLE_RANGE)}
          stroke="var(--muted)"
          strokeWidth={STROKE}
          fill="none"
        />
        <path
          d={arcPath(RADIUS + STROKE, RADIUS + STROKE, RADIUS, START_ANGLE, progressEnd)}
          stroke="url(#motivationGradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="font-bold text-primary">
          {clamped}%
        </text>
      </svg>

      <span
        className="mt-4 mb-4 max-sm:my-1 text-sm font-medium text-primary-foreground px-3 py-1 rounded-full shadow-sm"
        style={{ background: endColor }}
      >
        {message}
      </span>
    </div>
  );
}
