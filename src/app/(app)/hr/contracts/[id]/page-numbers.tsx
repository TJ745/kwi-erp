"use client";

import * as React from "react";

/**
 * While this page is open: "Page X of Y" in the bottom-left page margin, as on
 * the company's contract. A page-level style, removed on leaving the page.
 */
export function ContractPageNumbers() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-print-page-numbers", "");
    style.textContent =
      '@page { size: A4; margin: 0.4in 0.45in 0.55in 0.45in; @bottom-left { content: "Page " counter(page) " of " counter(pages); font-family: Calibri, Arial, sans-serif; font-size: 11px; color: #000; padding-left: 0.4in; } }';
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
  return null;
}
