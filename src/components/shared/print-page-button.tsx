"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintPageButton() {
  return (
    <Button
      size="sm"
      onClick={() => {
        window.print();
      }}
    >
      <Printer />
      Print / Save as PDF
    </Button>
  );
}
