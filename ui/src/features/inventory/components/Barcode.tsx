import { useMemo } from "react";
import { code128Bars, isCode128B, QUIET_ZONE } from "@/lib/code128";
import { cn } from "@/lib/utils";

// Code 128 SVG; scales to its container width. Bars are black on white for scanners, whatever the theme.
export function Barcode({
  value,
  height = 40,
  showText = true,
  className,
}: {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}) {
  // Bar rectangles in module units: [x, width] for every bar (even indexes; odd ones are spaces).
  const layout = useMemo(() => {
    if (!isCode128B(value)) return null;
    const widths = code128Bars(value);
    const starts = widths.map((_, i) => QUIET_ZONE + widths.slice(0, i).reduce((s, w) => s + w, 0));
    const bars = widths.flatMap((w, i) => (i % 2 === 0 ? [[starts[i]!, w] as const] : []));
    return { bars, width: widths.reduce((s, w) => s + w, 0) + QUIET_ZONE * 2 };
  }, [value]);
  if (!layout) return <p className="text-helper text-danger">Can't print “{value}” as a barcode</p>;
  const { bars, width } = layout;

  return (
    <figure className={cn("m-0", className)}>
      <svg
        role="img"
        aria-label={`Barcode ${value}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="block h-auto w-full bg-white fill-black"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {bars.map(([x, w]) => (
          <rect key={x} x={x} y={0} width={w} height={height} />
        ))}
      </svg>
      {showText && (
        <figcaption className="text-center font-mono text-[9px] leading-tight tracking-wider">{value}</figcaption>
      )}
    </figure>
  );
}
