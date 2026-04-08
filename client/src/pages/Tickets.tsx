import { useState, useEffect } from "react";
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
  TICKET_TYPES,
  PRIORITIES,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

// ── Semantic design tokens (intentional fixed colors) ─────────────────────────

// CSS variables handle light/dark automatically — defined in index.css
const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  NEW:         { dot: "var(--status-new-dot)",         text: "var(--status-new-text)",         bg: "var(--status-new-bg)"         },
  OPEN:        { dot: "var(--status-open-dot)",        text: "var(--status-open-text)",        bg: "var(--status-open-bg)"        },
  IN_PROGRESS: { dot: "var(--status-in-progress-dot)", text: "var(--status-in-progress-text)", bg: "var(--status-in-progress-bg)" },
  PROCESSING:  { dot: "var(--status-processing-dot)",  text: "var(--status-processing-text)",  bg: "var(--status-processing-bg)"  },
  RESOLVED:    { dot: "var(--status-resolved-dot)",    text: "var(--status-resolved-text)",    bg: "var(--status-resolved-bg)"    },
  CLOSED:      { dot: "var(--status-closed-dot)",      text: "var(--status-closed-text)",      bg: "var(--status-closed-bg)"      },
};

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
    cell: (info) => (
      <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>
        {CATEGORY_LABELS[info.getValue()]}
      </span>
    ),
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

  const [sorting, setSorting]       = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput]       = useState("");
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusValue | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityValue | "">("");
  const [typeFilter, setTypeFilter]         = useState<TicketTypeValue | "">("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [search, statusFilter, priorityFilter, typeFilter]);

  const hasFilters =
    search !== "" || statusFilter !== "" || priorityFilter !== "" || typeFilter !== "";

  function clearFilters() {
    setSearchInput(""); setSearch("");
    setStatusFilter(""); setPriorityFilter(""); setTypeFilter("");
  }

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ["tickets", sorting, pagination, search, statusFilter, priorityFilter, typeFilter],
    queryFn: async () => {
      const sortCol = sorting[0]?.id ?? "createdAt";
      const sortDir = sorting[0]?.desc !== false ? "desc" : "asc";
      const params  = new URLSearchParams({
        sortBy: sortCol, sortOrder: sortDir,
        page:     String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
      });
      if (search)         params.set("search",   search);
      if (statusFilter)   params.set("status",   statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (typeFilter)     params.set("type",      typeFilter);
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
    columns,
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
    <div className="px-6 py-8">

        {/* ── Page header ── */}
        <div className="mb-7">
          <div className="flex items-center gap-3">
            <h1
              className="text-3xl font-bold tracking-tight"
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
              className="h-8 text-xs rounded-lg px-3 border"
              style={{
                width: "140px",
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
              <SelectItem value="OPEN"        className="text-xs">{STATUS_LABELS["OPEN"]}</SelectItem>
              <SelectItem value="IN_PROGRESS" className="text-xs">{STATUS_LABELS["IN_PROGRESS"]}</SelectItem>
              <SelectItem value="CLOSED"      className="text-xs">{STATUS_LABELS["CLOSED"]}</SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter((v as string) === "all" ? "" : (v as TicketTypeValue))}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 border"
              style={{
                width: "148px",
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

          {/* Priority filter */}
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter((v as string) === "all" ? "" : (v as PriorityValue))}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 border"
              style={{
                width: "136px",
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

        {/* ── Table ── */}
        {!isError && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--rt-border)" }}>
            <table className="w-full" style={{ borderCollapse: "collapse", background: "var(--rt-surface)" }}>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    style={{ borderBottom: "1px solid var(--rt-border)", background: "#f9fafb" }}
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
                    <SkeletonRow key={i} colCount={columns.length} />
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
                        style={{ borderBottom: "1px solid var(--rt-border)", transition: "background 0.1s" }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background = "#fff9f6")
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
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: "var(--rt-text-3)" }}>Rows per page</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
                className="text-sm outline-none rounded-md px-2 py-1 cursor-pointer"
                style={{
                  background: "var(--rt-surface-2)",
                  border:     "1px solid var(--rt-border-2)",
                  color:      "var(--rt-text-2)",
                }}
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-mono" style={{ color: "var(--rt-text-3)" }}>
                {pagination.pageIndex + 1} / {totalPages || 1}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150"
                  style={{
                    background: "var(--rt-surface-2)",
                    border:     "1px solid var(--rt-border-2)",
                    color:      "var(--rt-text-2)",
                  }}
                  onMouseEnter={(e) => {
                    if (!table.getCanPreviousPage()) return;
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-accent)";
                    (e.currentTarget as HTMLElement).style.color       = "var(--rt-accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-border-2)";
                    (e.currentTarget as HTMLElement).style.color       = "var(--rt-text-2)";
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150"
                  style={{
                    background: "var(--rt-surface-2)",
                    border:     "1px solid var(--rt-border-2)",
                    color:      "var(--rt-text-2)",
                  }}
                  onMouseEnter={(e) => {
                    if (!table.getCanNextPage()) return;
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-accent)";
                    (e.currentTarget as HTMLElement).style.color       = "var(--rt-accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-border-2)";
                    (e.currentTarget as HTMLElement).style.color       = "var(--rt-text-2)";
                  }}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Tickets;
