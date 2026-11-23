"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubcontractorDialog, type SubcontractorValues } from "../subcontractor-dialog";

export function SubcontractorEditButton({ subcontractor }: { subcontractor: SubcontractorValues }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Pencil />
        Edit
      </Button>
      <SubcontractorDialog subcontractor={subcontractor} open={open} onOpenChange={setOpen} />
    </>
  );
}
