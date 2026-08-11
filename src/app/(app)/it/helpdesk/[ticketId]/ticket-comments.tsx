"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { readString } from "@/lib/form-data";
import { addTicketCommentAction } from "@/server/actions/it";

type Comment = {
  id: string;
  authorName: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

export function TicketComments({
  ticketId,
  comments,
  canPostInternal,
}: {
  ticketId: string;
  comments: Comment[];
  canPostInternal: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [isInternal, setIsInternal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addTicketCommentAction({
        ticketId,
        body: readString(fd, "body"),
        isInternal,
      });
      if (!result.success) {
        setError(result.fieldErrors?.body?.[0] ?? result.error);
        return;
      }
      formRef.current?.reset();
      setIsInternal(false);
      toast.success("Comment added.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Use comments to record what was tried and what the requester reported back."
          className="border-0 py-6"
        />
      ) : (
        <ul className="divide-y">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={cn(
                "py-3 first:pt-0",
                // Internal notes are visually distinct so staff never mistake
                // them for something the requester can see.
                comment.isInternal && "bg-status-warning-bg/40 -mx-2 rounded px-2",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {comment.authorName}
                  {comment.isInternal ? (
                    <Badge variant="warning" className="gap-1">
                      <Lock className="size-3" />
                      Internal
                    </Badge>
                  ) : null}
                </span>
                <time
                  dateTime={comment.createdAt}
                  className="text-muted-foreground text-xs tabular-nums"
                >
                  {comment.createdAt.slice(0, 16).replace("T", " ")}
                </time>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="ticket-comment" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="ticket-comment"
          name="body"
          rows={3}
          required
          disabled={pending}
          placeholder="Add a comment…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "ticket-comment-error" : undefined}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
        {error ? (
          <p id="ticket-comment-error" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          {canPostInternal ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="internal"
                checked={isInternal}
                onCheckedChange={(checked) => {
                  setIsInternal(checked === true);
                }}
              />
              <Label htmlFor="internal" className="font-normal">
                Internal note — hidden from the requester
              </Label>
            </div>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
