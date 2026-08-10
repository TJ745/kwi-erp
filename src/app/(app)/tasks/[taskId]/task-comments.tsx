"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { readString } from "@/lib/form-data";
import { addTaskCommentAction } from "@/server/actions/tasks";

type Comment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export function TaskComments({
  taskId,
  comments,
}: {
  taskId: string;
  comments: Comment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const fd = new FormData(event.currentTarget);
    const body = readString(fd, "body");

    startTransition(async () => {
      const result = await addTaskCommentAction({ taskId, body });
      if (!result.success) {
        setError(result.fieldErrors?.body?.[0] ?? result.error);
        return;
      }
      formRef.current?.reset();
      toast.success("Comment added.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Use comments to record what was chased, when, and what came back."
          className="border-0 py-6"
        />
      ) : (
        <ul className="divide-y">
          {comments.map((comment) => (
            <li key={comment.id} className="py-3 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{comment.authorName}</span>
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
        <label htmlFor="task-comment" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="task-comment"
          name="body"
          rows={3}
          required
          disabled={pending}
          placeholder="Add a comment…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "task-comment-error" : undefined}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
        {error ? (
          <p id="task-comment-error" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
