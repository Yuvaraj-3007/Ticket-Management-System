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
  STATUSES,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";
import {
  priorityVariant,
  statusVariant,
  typeVariant,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (direction === "asc")  return <ChevronUp className="ml-1 h-3.5 w-3.5 inline-block" />;
  if (direction === "desc") return <ChevronDown className="ml-1 h-3.5 w-3.5 inline-block" />;
  return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 inline-block opacity-40" />;
}

// ─── Column definitions ───────────────────────────────────────────────────────

const col = createColumnHelper<ApiTicket>();

const columns = [
  col.accessor("ticketId", {
    header: "ID",
    cell: (info) => (
      <span className="font-mono text-sm font-medium">{info.getValue()}</span>
    ),
  }),
  col.accessor("title", {
    header: "Title",
    enableSorting: false,
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <Link
            to={`/tickets/${row.ticketId}`}
            className="font-medium hover:underline"
          >
            {info.getValue()}
          </Link>
          {row.assignedTo && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Assigned to {row.assignedTo.name}
            </div>
          )}
        </div>
      );
    },
  }),
  col.accessor("type", {
    header: "Category",
    cell: (info) => {
      const v = info.getValue();
      return <Badge variant={typeVariant(v)}>{CATEGORY_LABELS[v]}</Badge>;
    },
  }),
  col.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const v = info.getValue();
      return <Badge variant={priorityVariant(v)}>{PRIORITY_LABELS[v]}</Badge>;
    },
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => {
      const v = info.getValue();
      return <Badge variant={statusVariant(v)}>{STATUS_LABELS[v]}</Badge>;
    },
  }),
  col.accessor("project", {
    header: "Project",
    cell: (info) => <span className="text-sm">{info.getValue()}</span>,
  }),
  col.accessor("createdAt", {
    header: "Created",
    cell: (info) => (
      <span className="text-sm text-muted-foreground">
        {new Date(info.getValue()).toLocaleDateString()}
      </span>
    ),
  }),
];

// ─── Subtitle helper ──────────────────────────────────────────────────────────

const COLUMN_LABELS: Record<string, string> = {
  ticketId:  "ticket ID",
  type:      "category",
  priority:  "priority",
  status:    "status",
  project:   "project",
  createdAt: "date",
};

function sortSubtitle(sorting: SortingState): string {
  if (sorting.length === 0) return "newest first";
  const { id, desc } = sorting[0];
  if (id === "createdAt") return desc ? "newest first" : "oldest first";
  const label = COLUMN_LABELS[id] ?? id;
  return `sorted by ${label} (${desc ? "Z→A" : "A→Z"})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

function Tickets() {
  "use no memo"; // TanStack Table v8 returns functions that React Compiler can't safely memoize

  const [sorting, setSorting]     = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // Filter state
  const [searchInput, setSearchInput]       = useState("");
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState<StatusValue | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityValue | "">("");
  const [typeFilter, setTypeFilter]         = useState<TicketTypeValue | "">("");

  // Debounce search input (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search, statusFilter, priorityFilter, typeFilter]);

  const hasFilters = search !== "" || statusFilter !== "" || priorityFilter !== "" || typeFilter !== "";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setTypeFilter("");
  }

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ["tickets", sorting, pagination, search, statusFilter, priorityFilter, typeFilter],
    queryFn: async () => {
      const sortCol = sorting[0]?.id ?? "createdAt";
      const sortDir = sorting[0]?.desc !== false ? "desc" : "asc";
      const params  = new URLSearchParams({
        sortBy:   sortCol,
        sortOrder: sortDir,
        page:     String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
      });
      if (search)         params.set("search",   search);
      if (statusFilter)   params.set("status",   statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (typeFilter)     params.set("type",      typeFilter);
      const res = await axios.get(
        `${API_URL}/api/tickets?${params.toString()}`,
        { withCredentials: true }
      );
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
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Skeleton className="h-7 w-40 mb-1" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {["ID", "Title", "Category", "Priority", "Status", "Project", "Created"].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
            Failed to load tickets. Please refresh the page.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Tickets</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} {total === 1 ? "ticket" : "tickets"} — {sortSubtitle(sorting)}
              {hasFilters && " (filtered)"}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="Search by title…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-56"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v as string) === "all" ? "" : v as StatusValue)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter((v as string) === "all" ? "" : v as PriorityValue)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v as string) === "all" ? "" : v as TicketTypeValue)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {TICKET_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{CATEGORY_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 px-2" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted  = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className={canSort ? "cursor-pointer select-none" : undefined}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIcon direction={sorted} />}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-12"
                  >
                    No tickets yet. Send an email to the webhook to create one.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Page {pagination.pageIndex + 1} of {totalPages || 1}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Tickets;
