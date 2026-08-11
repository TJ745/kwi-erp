import "server-only";
import type { Prisma, TicketStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ForbiddenError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import type { TicketInput } from "@/lib/schemas/it";
import { nextTicketNo } from "./counter";

/**
 * IT helpdesk.
 *
 * Anyone may raise a ticket; only IT staff may assign, resolve, or see internal
 * comments. Requesters see their own tickets, so a user cannot browse the
 * whole queue by guessing ids.
 */

const SORTABLE = ["ticketNo", "priority", "status", "createdAt", "dueDate"] as const;

const CLOSED_STATUSES: TicketStatus[] = ["RESOLVED", "CLOSED"];

export type TicketListRow = {
  id: string;
  ticketNo: string;
  subject: string;
  status: TicketStatus;
  priority: string;
  categoryName: string;
  companyCode: string;
  requesterName: string | null;
  assignedToName: string | null;
  createdAt: Date;
  commentCount: number;
};

/** Without it.tickets.view an actor sees only tickets they raised. */
function visibilityWhere(ctx: ActorContext): Prisma.ITTicketWhereInput {
  if (ctx.permissions.has("it.tickets.assign") || ctx.permissions.has("it.manage")) return {};
  return { OR: [{ requesterId: ctx.userId }, { assignedToId: ctx.userId }] };
}

export async function listTickets(
  ctx: ActorContext,
  query: ListQuery,
  filters: { status?: string | undefined; priority?: string | undefined; mine?: boolean } = {},
): Promise<Paginated<TicketListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "createdAt", direction: "desc" });

  const where: Prisma.ITTicketWhereInput = {
    ...companyScopeWhere(ctx),
    ...visibilityWhere(ctx),
    ...(filters.status === "OPEN_ONLY"
      ? { status: { notIn: CLOSED_STATUSES } }
      : filters.status
        ? { status: filters.status as TicketStatus }
        : {}),
    ...(filters.priority ? { priority: filters.priority as "LOW" } : {}),
    ...(filters.mine ? { assignedToId: ctx.userId } : {}),
    ...(query.q
      ? {
          OR: [
            { subject: { contains: query.q, mode: "insensitive" } },
            { ticketNo: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.iTTicket.findMany({
      where,
      orderBy: { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        ticketNo: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        requesterId: true,
        assignedToId: true,
        category: { select: { name: true } },
        company: { select: { code: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.iTTicket.count({ where }),
  ]);

  const names = await resolveUserNames(
    rows.flatMap((r) => [r.requesterId, r.assignedToId]),
  );

  return paginate(
    rows.map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      categoryName: t.category.name,
      companyCode: t.company.code,
      requesterName: names.get(t.requesterId) ?? null,
      assignedToName: t.assignedToId ? (names.get(t.assignedToId) ?? null) : null,
      createdAt: t.createdAt,
      commentCount: t._count.comments,
    })),
    total,
    query,
  );
}

/** ITTicket has no DB relation to User, so names resolve in a batched lookup. */
async function resolveUserNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function getTicket(ctx: ActorContext, id: string) {
  const isItStaff =
    ctx.permissions.has("it.tickets.assign") || ctx.permissions.has("it.manage");

  const ticket = await prisma.iTTicket.findFirst({
    where: { id, ...companyScopeWhere(ctx), ...visibilityWhere(ctx) },
    select: {
      id: true,
      ticketNo: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      resolution: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      dueDate: true,
      requesterId: true,
      assignedToId: true,
      companyId: true,
      category: { select: { name: true } },
      company: { select: { code: true } },
      department: { select: { name: true } },
      asset: { select: { id: true, assetCode: true, brand: true, model: true } },
      comments: {
        // Internal notes are withheld from the requester entirely.
        where: isItStaff ? {} : { isInternal: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, authorId: true, body: true, isInternal: true, createdAt: true },
      },
    },
  });
  if (!ticket) throw new NotFoundError("Ticket not found.");

  const names = await resolveUserNames([
    ticket.requesterId,
    ticket.assignedToId,
    ...ticket.comments.map((c) => c.authorId),
  ]);

  return {
    ...ticket,
    requesterName: names.get(ticket.requesterId) ?? "Unknown",
    assignedToName: ticket.assignedToId ? (names.get(ticket.assignedToId) ?? null) : null,
    comments: ticket.comments.map((c) => ({
      ...c,
      authorName: names.get(c.authorId) ?? "Unknown",
    })),
  };
}

export async function createTicket(ctx: ActorContext, input: TicketInput) {
  requireCompanyAccess(ctx, input.companyId);

  const category = await prisma.ticketCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true, defaultSlaHours: true },
  });
  if (!category) throw new NotFoundError("Ticket category not found.");

  const dueDate = category.defaultSlaHours
    ? new Date(Date.now() + category.defaultSlaHours * 60 * 60 * 1000)
    : null;

  return prisma.$transaction(async (tx) => {
    const ticketNo = await nextTicketNo(tx);

    return tx.iTTicket.create({
      data: {
        ticketNo,
        companyId: input.companyId,
        requesterId: ctx.userId,
        departmentId: input.departmentId ?? null,
        categoryId: input.categoryId,
        priority: input.priority,
        subject: input.subject,
        description: input.description,
        relatedAssetId: input.relatedAssetId ?? null,
        dueDate,
        status: "OPEN",
      },
      select: { id: true, ticketNo: true, subject: true, companyId: true },
    });
  });
}

export async function assignTicket(
  ctx: ActorContext,
  input: { id: string; assignedToId?: string | undefined },
) {
  const ticket = await prisma.iTTicket.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, ticketNo: true, assignedToId: true, companyId: true },
  });
  if (!ticket) throw new NotFoundError("Ticket not found.");

  if (input.assignedToId) {
    const user = await prisma.user.findFirst({
      where: { id: input.assignedToId, status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundError("The selected technician is not an active user.");
  }

  await prisma.iTTicket.update({
    where: { id: input.id },
    data: {
      assignedToId: input.assignedToId ?? null,
      // Picking up a new ticket moves it out of the unstarted queue.
      ...(input.assignedToId ? { status: "IN_PROGRESS" } : {}),
    },
  });

  const names = await resolveUserNames([ticket.assignedToId, input.assignedToId ?? null]);

  return {
    ticketNo: ticket.ticketNo,
    companyId: ticket.companyId,
    before: { assignedTo: ticket.assignedToId ? names.get(ticket.assignedToId) : null },
    after: { assignedTo: input.assignedToId ? names.get(input.assignedToId) : null },
  };
}

export async function setTicketStatus(
  ctx: ActorContext,
  input: { id: string; status: TicketStatus; resolution?: string | undefined },
) {
  const ticket = await prisma.iTTicket.findFirst({
    where: { id: input.id, ...companyScopeWhere(ctx) },
    select: { id: true, ticketNo: true, status: true, companyId: true, resolvedAt: true },
  });
  if (!ticket) throw new NotFoundError("Ticket not found.");

  const isResolving = input.status === "RESOLVED";
  const isClosing = input.status === "CLOSED";

  await prisma.iTTicket.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(input.resolution ? { resolution: input.resolution } : {}),
      // Timestamps track the transition and clear if a ticket is reopened.
      resolvedAt: isResolving || isClosing ? (ticket.resolvedAt ?? new Date()) : null,
      closedAt: isClosing ? new Date() : null,
    },
  });

  return {
    ticketNo: ticket.ticketNo,
    companyId: ticket.companyId,
    before: { status: ticket.status },
    after: { status: input.status },
  };
}

export async function addTicketComment(
  ctx: ActorContext,
  input: { ticketId: string; body: string; isInternal: boolean },
) {
  const ticket = await getTicket(ctx, input.ticketId);

  // Only IT staff may leave internal notes; a requester posting one would
  // otherwise create a note they could then read back.
  const isItStaff =
    ctx.permissions.has("it.tickets.assign") || ctx.permissions.has("it.manage");
  if (input.isInternal && !isItStaff) {
    throw new ForbiddenError("Only IT staff can add internal notes.");
  }

  await prisma.ticketComment.create({
    data: {
      ticketId: input.ticketId,
      authorId: ctx.userId,
      body: input.body,
      isInternal: input.isInternal,
    },
  });

  return { ticketNo: ticket.ticketNo, companyId: ticket.companyId };
}

export type TicketCounts = {
  open: number;
  unassigned: number;
  critical: number;
  mine: number;
};

export async function ticketCounts(ctx: ActorContext): Promise<TicketCounts> {
  const base = { ...companyScopeWhere(ctx), ...visibilityWhere(ctx) };

  const [open, unassigned, critical, mine] = await Promise.all([
    prisma.iTTicket.count({ where: { ...base, status: { notIn: CLOSED_STATUSES } } }),
    prisma.iTTicket.count({
      where: { ...base, status: { notIn: CLOSED_STATUSES }, assignedToId: null },
    }),
    prisma.iTTicket.count({
      where: { ...base, status: { notIn: CLOSED_STATUSES }, priority: "CRITICAL" },
    }),
    prisma.iTTicket.count({
      where: { ...base, status: { notIn: CLOSED_STATUSES }, assignedToId: ctx.userId },
    }),
  ]);

  return { open, unassigned, critical, mine };
}

export async function ticketCategories() {
  return prisma.ticketCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, defaultSlaHours: true },
  });
}

export async function itStaff() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true },
  });
}
