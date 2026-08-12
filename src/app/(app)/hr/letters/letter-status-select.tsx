"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLetterStatusAction } from "@/server/actions/letters";

const STATUSES = ["GENERATED", "ISSUED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

export function LetterStatusSelect({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [value, setValue] = React.useState<Status>(status);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    const previous = value;
    setValue(next as Status);

    startTransition(async () => {
      const result = await setLetterStatusAction({ id, status: next });
      if (!result.success) {
        // Revert rather than leave the row showing a state the server rejected.
        setValue(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger size="sm" className="w-[130px]" aria-label="Letter status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
