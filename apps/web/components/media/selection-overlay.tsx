"use client";

type SelectionOverlayProps = {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  visible: boolean;
};

export function SelectionOverlay({ start, end, visible }: SelectionOverlayProps) {
  if (!visible || !start || !end) return null;

  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return (
    <div
      className="pointer-events-none fixed z-40 border-2 border-primary bg-primary/10"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}
