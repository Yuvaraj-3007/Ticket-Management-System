import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import {
  paginatedTicketsSchema,
  type ApiTicket,
  TICKET_TYPE,
  TICKET_TYPES,
  PRIORITIES,
  STATUSES,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";
import {
  CATEGORY_CLASS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import { STATUS_CONFIG } from "@/lib/status-config";
import { TicketSlidePanel } from "@/components/TicketSlidePanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  X,
  Search,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

// Tab filter buckets — drives the type[] sent to GET /api/tickets
type TabFilter = "all" | "bug" | "impl";
const BUG_TYPES: readonly TicketTypeValue[] = [
  TICKET_TYPE.BUG,
  TICKET_TYPE.REQUIREMENT,
  TICKET_TYPE.TASK,
  TICKET_TYPE.SUPPORT,
  TICKET_TYPE.EXPLANATION,
];
const IMPL_TYPES: readonly TicketTypeValue[] = [TICKET_TYPE.IMPLEMENTATION];

// ── Semantic design tokens (intentional fixed colors) ─────────────────────────

const PRIORITY_CONFIG: Record<string, { bar: string; textDark: string; textLight: string }> = {
  CRITICAL: { bar: "#EF4444", textDark: "#FCA5A5", textLight: "#B91C1C" },
  HIGH:     { bar: "#F97316", textDark: "#FDBA74", textLight: "#C2410C" },
  MEDIUM:   { bar: "#EAB308", textDark: "#FDE047", textLight: "#92400E" },
  LOW:      { bar: "var(--rt-border-2)", textDark: "var(--rt-text-3)", textLight: "var(--rt-text-3)" },
};

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  const base = "ml-1 h-3 w-3 inline-block";
  if (direction === "asc")  return <ChevronUp   className={base} style={{ color: "var(--rt-accent)" }} />;
  if (direction === "desc") return <ChevronDown  className={base} style={{ color: "var(--rt-accent)" }} />;
  return <ChevronsUpDown className={base} style={{ color: "var(--rt-text-3)", opacity: 0.5 }} />;
}

// ── Column definitions ────────────────────────────────────────────────────────

const col = createColumnHelper<ApiTicket>();

const columns = [
  col.accessor("ticketId", {
    header: "ID",
    enableSorting: false,
    cell: (info) => (
      <Link
        to={`/tickets/${info.row.original.id}`}
        className="font-mono text-xs font-semibold"
        style={{ color: "var(--rt-accent)", textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor("title", {
    header: "Subject",
    enableSorting: false,
    cell: (info) => {
      const row = info.row.original;
      return (
        <Link
          to={`/tickets/${row.ticketId}`}
          className="text-sm font-medium line-clamp-1 transition-colors duration-150"
          style={{ color: "var(--rt-text-1)", textDecoration: "none" }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--rt-accent)")}
          onMouseLeave={(e)  => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--rt-text-1)")}
        >
          {info.getValue()}
        </Link>
      );
    },
  }),
  col.accessor("createdBy", {
    id: "sender",
    header: "Sender",
    enableSorting: false,
    cell: (info) => {
      const row   = info.row.original;
      const name  = row.senderName  ?? info.getValue().name;
      const email = row.senderEmail ?? row.project;
      return (
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--rt-text-2)" }}>{name}</p>
          <p className="text-xs truncate"               style={{ color: "var(--rt-text-3)" }}>{email}</p>
        </div>
      );
    },
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => {
      const v   = info.getValue();
      const cfg = STATUS_CONFIG[v] ?? STATUS_CONFIG.CLOSED;
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap"
          style={{ background: cfg.bg, color: cfg.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
          {STATUS_LABELS[v]}
        </span>
      );
    },
  }),
  col.accessor("type", {
    header: "Category",
    cell: (info) => {
      const v   = info.getValue();
      const cls = CATEGORY_CLASS[v];
      if (cls) {
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${cls}`}
          >
            {CATEGORY_LABELS[v]}
          </span>
        );
      }
      return (
        <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>
          {CATEGORY_LABELS[v]}
        </span>
      );
    },
  }),
  col.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const v   = info.getValue();
      const cfg = PRIORITY_CONFIG[v] ?? PRIORITY_CONFIG.LOW;
      return (
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.textDark }}>
          {PRIORITY_LABELS[v]}
        </span>
      );
    },
  }),
  col.accessor("createdAt", {
    header: "Date",
    cell: (info) => {
      const d = new Date(info.getValue());
      return (
        <div className="text-xs font-mono" style={{ color: "var(--rt-text-3)" }}>
          <div>{d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          <div style={{ color: "var(--rt-text-3)", opacity: 0.7 }}>
            {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      );
    },
  }),
  col.display({
    id:     "lastCustomerReplyAt",
    header: "Last Active",
    cell:   (info) => {
      const raw = info.row.original.lastCustomerReplyAt;
      if (!raw) {
        return <span className="text-xs" style={{ color: "var(--rt-text-3)", opacity: 0.4 }}>—</span>;
      }
      const d = new Date(raw);
      return (
        <div className="text-xs font-mono" style={{ color: "var(--rt-accent)" }}>
          <div>{d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          <div style={{ opacity: 0.8 }}>
            {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      );
    },
  }),
];

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ colCount }: { colCount: number }) {
  const widths = ["w-14", "w-48", "w-28", "w-20", "w-16", "w-14", "w-20", "w-20"];
  return (
    <tr style={{ borderBottom: "1px solid var(--rt-border)" }}>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div
            className={`h-3 rounded animate-pulse ${widths[i % widths.length]}`}
            style={{ background: "var(--rt-border)" }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function Tickets() {
  "use no memo";

  const [searchParams] = useSearchParams();

  const [sorting, setSorting]       = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput]       = useState("");
  const [search, setSearch]                 = useState("");
  const [tabFilter, setTabFilter]           = useState<TabFilter>("all");
  const [statusFilter, setStatusFilter]     = useState<StatusValue | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityValue | "">("");
  const [typeFilter, setTypeFilter]         = useState<TicketTypeValue | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [clientFilter,  setClientFilter]   = useState(searchParams.get("clientId") ?? "");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [selectedTicket, setSelectedTicket] = useState<ApiTicket | null>(null);
  const closePanel = useCallback(() => setSelectedTicket(null), []);
  const navigate = useNavigate();

  const allColumns = useMemo(
    () => [
      ...columns,
      col.display({
        id: "actions",
        header: "Action",
        enableSorting: false,
        cell: (info) => (
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedTicket(info.row.original); }}
            className="p-1 rounded-md opacity-30 hover:opacity-100 transition-opacity"
            style={{ color: "var(--rt-text-2)" }}
            title="Quick view"
          >
            <Eye className="h-4 w-4" />
          </button>
        ),
      }),
    ],
    [setSelectedTicket]
  );

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [search, tabFilter, statusFilter, priorityFilter, typeFilter, assigneeFilter, clientFilter, dateFrom, dateTo]);

  const hasFilters =
    search !== "" || statusFilter !== "" || priorityFilter !== "" || typeFilter !== "" ||
    assigneeFilter !== "" || clientFilter !== "" || dateFrom !== "" || dateTo !== "";

  // Effective type filter sent to the server. Tabs win when active so the user
  // doesn't see contradictory filters (the dropdown is hidden in those tabs).
  const effectiveTypeFilter: readonly TicketTypeValue[] | null =
    tabFilter === "bug"  ? BUG_TYPES :
    tabFilter === "impl" ? IMPL_TYPES :
    typeFilter           ? [typeFilter] :
    null;

  function clearFilters() {
    setSearchInput(""); setSearch("");
    setStatusFilter(""); setPriorityFilter(""); setTypeFilter("");
    setAssigneeFilter(""); setClientFilter(""); setDateFrom(""); setDateTo("");
  }

  const { data: agentUsers = [] } = useQuery({
    queryKey: ["assignable-users-all"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/assignable-users`, { withCredentials: true });
      return res.data as Array<{ id: string; name: string }>;
    },
    staleTime: 60_000,
  });

  const { data: clientList = [] } = useQuery({
    queryKey: ["ticket-clients"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/clients`, { withCredentials: true });
      return res.data as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
  });

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ["tickets", sorting, pagination, search, tabFilter, statusFilter, priorityFilter, typeFilter, assigneeFilter, clientFilter, dateFrom, dateTo],
    queryFn: async () => {
      const sortCol = sorting[0]?.id ?? "createdAt";
      const sortDir = sorting[0]?.desc !== false ? "desc" : "asc";
      const params  = new URLSearchParams({
        sortBy: sortCol, sortOrder: sortDir,
        page:     String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
      });
      if (search)         params.set("search",       search);
      if (statusFilter)   params.set("status",       statusFilter);
      if (priorityFilter) params.set("priority",     priorityFilter);
      // Repeated `type` query params produce an array filter on the server
      // (ticketQuerySchema accepts string | string[] and normalises to string[]).
      if (effectiveTypeFilter) {
        for (const t of effectiveTypeFilter) params.append("type", t);
      }
      if (assigneeFilter) params.set("assignedToId", assigneeFilter);
      if (clientFilter)   params.set("clientId",     clientFilter);
      if (dateFrom)       params.set("from",          dateFrom);
      if (dateTo)         params.set("to",            dateTo);
      const res = await axios.get(`${API_URL}/api/tickets?${params}`, { withCredentials: true });
      return paginatedTicketsSchema.parse(res.data);
    },
  });

  const tickets    = result?.data       ?? [];
  const total      = result?.total      ?? 0;
  const totalPages = result?.totalPages ?? 1;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tickets,
    columns: allColumns,
    state: { sorting, pagination },
    onSortingChange: (upd) => {
      setSorting(upd);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    manualSorting:     true,
    manualPagination:  true,
    pageCount:         totalPages,
    getCoreRowModel:   getCoreRowModel(),
  });

  return (
    <>
    <div className="px-4 sm:px-6 py-4 sm:py-8">

        {/* ── Page header ── */}
        <div className="mb-7">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "var(--rt-text-1)" }}
            >
              Tickets
            </h1>
            {!isLoading && (
              <span
                className="text-sm font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: "var(--rt-accent-bg)", color: "var(--rt-accent)", border: "1px solid var(--rt-accent)" }}
              >
                {total.toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--rt-text-3)" }}>
            Manage and track all incoming support requests
          </p>
        </div>

        {/* ── Type tabs ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Ticket type tabs">
          {([
            { value: "all",  label: "All"                     },
            { value: "bug",  label: "Bugs & Support"          },
            { value: "impl", label: "New Requirements" },
          ] as { value: TabFilter; label: string }[]).map((t) => {
            const active = tabFilter === t.value;
            return (
              <Button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => { setTabFilter(t.value); setStatusFilter(""); }}
              >
                {t.label}
              </Button>
            );
          })}
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1 min-w-[180px]"
            style={{ background: "var(--rt-surface)", border: "1px solid var(--rt-border)" }}
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--rt-text-3)" }} />
            <input
              type="text"
              placeholder="Search tickets…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-transparent text-xs outline-none w-full placeholder:opacity-50"
              style={{ color: "var(--rt-text-2)", caretColor: "var(--rt-accent)" }}
            />
            {searchInput && (
              <button onClick={() => setSearchInput("")}>
                <X className="h-3 w-3" style={{ color: "var(--rt-text-3)" }} />
              </button>
            )}
          </div>

          {/* Status filter — only show statuses visible in the ticket list */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter((v as string) === "all" ? "" : (v as StatusValue))}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 border w-full sm:w-[140px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      statusFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
              }}
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              {/* Filter status options by active tab so impl-only statuses
                  don't appear on Bug & Support and vice versa. */}
              {(tabFilter === "bug"
                ? STATUSES.filter((s) => !["SUBMITTED", "ADMIN_REVIEW", "PLANNING", "CUSTOMER_APPROVAL", "APPROVED"].includes(s))
                : tabFilter === "impl"
                ? (["SUBMITTED", "ADMIN_REVIEW", "PLANNING", "CUSTOMER_APPROVAL", "APPROVED", "OPEN_IN_PROGRESS", "OPEN_DONE", "CLOSED"] as StatusValue[])
                : STATUSES
              ).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category filter — hidden when a type tab is active to avoid contradictory filters */}
          {tabFilter === "all" && (
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter((v as string) === "all" ? "" : (v as TicketTypeValue))}
            >
              <SelectTrigger
                className="h-8 text-xs rounded-lg px-3 border w-full sm:w-[148px]"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      typeFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                  boxShadow:  "none",
                }}
              >
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All categories</SelectItem>
                {TICKET_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{CATEGORY_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Priority filter */}
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter((v as string) === "all" ? "" : (v as PriorityValue))}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 border w-full sm:w-[136px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      priorityFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
              }}
            >
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client filter */}
          <Select
            value={clientFilter}
            onValueChange={(v) => setClientFilter(!v || v === "all" ? "" : v)}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 w-full sm:w-[160px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      clientFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
              }}
            >
              <span className="truncate">
                {clientFilter
                  ? (clientList.find((c) => c.id === clientFilter)?.name ?? "Loading…")
                  : "All clients"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All clients</SelectItem>
              {clientList.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee filter */}
          <Select
            value={assigneeFilter}
            onValueChange={(v) => setAssigneeFilter(!v || v === "all" ? "" : v)}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 w-full sm:w-[160px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      assigneeFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
              }}
            >
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"        className="text-xs">All assignees</SelectItem>
              <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
              {agentUsers.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range — From / To */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs rounded-lg px-2 outline-none"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      "var(--rt-text-2)",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs rounded-lg px-2 outline-none"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      "var(--rt-text-2)",
                }}
              />
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 ml-auto transition-all duration-150"
              style={{
                color:      "var(--rt-text-3)",
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color       = "#EF4444";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.25)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color       = "var(--rt-text-3)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-border-2)";
              }}
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* ── Error state ── */}
        {isError && (
          <div
            className="text-sm py-3 px-4 rounded-lg mb-4"
            style={{
              background: "rgba(239,68,68,0.08)",
              color:      "#EF4444",
              border:     "1px solid rgba(239,68,68,0.18)",
            }}
          >
            Failed to load tickets. Please refresh the page.
          </div>
        )}

        {/* ── Mobile card list (< md) ── */}
        {!isError && (
          <div className="flex flex-col gap-2 md:hidden" aria-hidden="true">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "var(--rt-surface)", border: "1px solid var(--rt-border)" }}>
                    <div className="h-3 rounded w-20 mb-3" style={{ background: "var(--rt-border)" }} />
                    <div className="h-3 rounded w-48 mb-2" style={{ background: "var(--rt-border)" }} />
                    <div className="h-3 rounded w-32" style={{ background: "var(--rt-border)" }} />
                  </div>
                ))
              : tickets.length === 0
              ? (
                  <div className="py-16 text-center">
                    <p className="text-sm" style={{ color: "var(--rt-text-3)" }}>
                      {hasFilters ? "No tickets match your filters" : "No tickets yet"}
                    </p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-xs mt-2" style={{ color: "var(--rt-accent)" }}>
                        Clear filters
                      </button>
                    )}
                  </div>
                )
              : tickets.map((ticket) => {
                  const sc = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.CLOSED;
                  const pc = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.LOW;
                  return (
                    <Link
                      key={ticket.id}
                      to={`/tickets/${ticket.ticketId}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        className="rounded-xl p-4 transition-colors"
                        style={{ background: "var(--rt-surface)", border: "1px solid var(--rt-border)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--rt-surface-2)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--rt-surface)")}
                      >
                        {/* Row 1: ID + Status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-semibold" style={{ color: "var(--rt-accent)" }}>
                            {ticket.ticketId}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
                            {STATUS_LABELS[ticket.status]}
                          </span>
                        </div>
                        {/* Row 2: Subject */}
                        <p className="text-sm font-semibold mb-2 line-clamp-1" style={{ color: "var(--rt-text-1)" }}>
                          {ticket.title}
                        </p>
                        {/* Row 3: Sender */}
                        <div className="flex items-center gap-1 mb-3">
                          <p className="text-xs font-medium" style={{ color: "var(--rt-text-2)" }}>
                            {ticket.senderName ?? ticket.createdBy?.name}
                          </p>
                          <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>·</span>
                          <p className="text-xs truncate" style={{ color: "var(--rt-text-3)" }}>
                            {ticket.senderEmail ?? ticket.project}
                          </p>
                        </div>
                        {/* Row 4: Priority + Category + Date */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: pc.textLight }}>
                            {PRIORITY_LABELS[ticket.priority]}
                          </span>
                          {CATEGORY_CLASS[ticket.type] ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${CATEGORY_CLASS[ticket.type]}`}
                            >
                              {CATEGORY_LABELS[ticket.type]}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>
                              {CATEGORY_LABELS[ticket.type]}
                            </span>
                          )}
                          <span className="text-xs font-mono ml-auto" style={{ color: "var(--rt-text-3)" }}>
                            {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
          </div>
        )}

        {/* ── Table (md+) ── */}
        {!isError && (
          <div className="hidden md:block rounded-xl overflow-x-auto" style={{ border: "1px solid var(--rt-border)" }}>
            <table className="w-full min-w-[700px]" style={{ borderCollapse: "collapse", background: "var(--rt-surface)" }}>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    style={{ borderBottom: "1px solid var(--rt-border)", background: "var(--rt-surface-2)" }}
                  >
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted  = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          className={`text-left px-4 py-3.5 text-xs font-bold uppercase tracking-[0.08em] select-none ${
                            canSort ? "cursor-pointer" : ""
                          }`}
                          style={{ color: sorted ? "var(--rt-accent)" : "var(--rt-text-1)" }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIcon direction={sorted} />}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} colCount={columns.length + 1} />
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ background: "var(--rt-surface-2)", border: "1px solid var(--rt-border-2)" }}
                        >
                          <Search className="h-5 w-5" style={{ color: "var(--rt-text-3)" }} />
                        </div>
                        <p className="text-sm" style={{ color: "var(--rt-text-3)" }}>
                          {hasFilters ? "No tickets match your filters" : "No tickets yet"}
                        </p>
                        {hasFilters && (
                          <button
                            onClick={clearFilters}
                            className="text-xs transition-colors"
                            style={{ color: "var(--rt-accent)" }}
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    return (
                      <tr
                        key={row.id}
                        style={{ borderBottom: "1px solid var(--rt-border)", transition: "background 0.1s", cursor: "pointer" }}
                        onClick={() => navigate(`/tickets/${row.original.ticketId}`)}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background = "var(--rt-surface-2)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background = "transparent")
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!isLoading && !isError && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Rows per page</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
                className="text-xs outline-none rounded-md px-2 py-1 cursor-pointer border"
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {total} tickets · page {pagination.pageIndex + 1} of {totalPages || 1}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>

    <TicketSlidePanel ticket={selectedTicket} onClose={closePanel} />
    </>
  );
}

export default Tickets;
