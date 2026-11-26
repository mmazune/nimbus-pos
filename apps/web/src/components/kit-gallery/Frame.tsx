import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { Text } from "@/components/kit";

/** Set when /kit?only=<id> renders one frame alone, at its real size. */
export const SoloContext = createContext<string | null>(null);

export type FrameProps = {
  id: string;
  label: string;
  width: number;
  height: number;
  children: ReactNode;
};

/**
 * A device-sized frame. In the gallery it is scaled down (CSS transform) to fit
 * the page width, so nothing scrolls sideways; a transform does not change
 * layout sizes, so offsetWidth/offsetHeight still measure the real px. With
 * ?only=<id> it renders alone at scale 1, for screenshots beside the drawings.
 */
export function Frame({ id, label, width, height, children }: FrameProps) {
  const solo = useContext(SoloContext);
  const outer = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    const el = outer.current;
    if (!el || solo) return;
    const update = () => setAvailable(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [solo]);

  const inner = (
    <div
      data-kit-frame={id}
      className="relative flex flex-col overflow-hidden bg-kit-canvas text-kit-text font-kit"
      style={{
        width,
        height,
        transform: solo ? undefined : `scale(${available ? Math.min(1, available / width) : 1})`,
        transformOrigin: "0 0",
      }}
    >
      {children}
    </div>
  );

  if (solo) return inner;

  const scale = available ? Math.min(1, available / width) : 1;
  return (
    <figure className="m-kit-0 flex w-full flex-col gap-kit-8" style={{ maxWidth: width }}>
      <figcaption>
        <Text variant="small" tone="muted">
          {`${label} · ${width} × ${height}${scale < 1 ? ` · shown at ${Math.round(scale * 100)} %` : ""}`}
        </Text>
      </figcaption>
      <div ref={outer} className="w-full">
        <div className="max-w-full overflow-hidden rounded-kit-card-lg shadow-kit-raised" style={{ width: width * scale, height: height * scale }}>
          {inner}
        </div>
      </div>
    </figure>
  );
}
