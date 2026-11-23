"use client";

import * as React from "react";

/**
 * Shrinks its content to fit one printed landscape A4 page. The scale is
 * measured on screen and applied only in print, through a CSS variable, so it
 * holds whether the page is printed from the dialog or saved as a PDF.
 */
export function FitToPage({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Landscape A4 inside 0.35in margins, at 96 px per inch.
      const pageW = (11.69 - 0.7) * 96;
      const pageH = (8.27 - 0.7) * 96;
      const scale = Math.min(1, pageW / el.scrollWidth, pageH / el.scrollHeight);
      el.style.setProperty("--fit", String(Math.floor(scale * 1000) / 1000));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div ref={ref} className="fit-to-page w-max">
      {children}
    </div>
  );
}
