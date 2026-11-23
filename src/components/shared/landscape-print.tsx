"use client";

import * as React from "react";

/**
 * Prints this page on landscape A4. While the page is open it adds an
 * `@page` rule that comes after the app's default one, so it wins the
 * cascade; leaving the page removes it, and letters keep printing portrait.
 * (A named page on the root element is not honoured by Chromium.)
 */
export function LandscapePrint() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-print-landscape", "");
    style.textContent = "@page { size: A4 landscape; margin: 0.35in; }";
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
  return null;
}
