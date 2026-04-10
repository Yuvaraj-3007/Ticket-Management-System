import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "axios";
import { Building2, Copy, Check, ExternalLink, Tickets, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = import.meta.env.VITE_API_URL || "";

interface Client {
  id:   string;
  name: string;
}

/** Matches the server-side slugifyName in lib/hrms.ts */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy URL"
      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
      style={{
        color:      copied ? "var(--rt-accent)" : "var(--rt-text-3)",
        background: "transparent",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--rt-accent-bg)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const PAGE_SIZE = 10;

export default function Clients() {
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const { data: clients = [], isLoading, isError } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn:  async () => {
      const res = await axios.get(`${API_URL}/api/tickets/clients`, { withCredentials: true });
      return res.data as Client[];
    },
  });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const baseUrl = window.location.origin;

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: "var(--rt-text-1)" }}
          >
            Clients
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--rt-text-3)" }}>
            All active clients from HRMS — share the portal URL with each client
          </p>
        </div>

        {!isLoading && !isError && (
          <Badge variant="secondary" className="text-sm px-3 py-1 mt-1">
            {clients.length} {clients.length === 1 ? "client" : "clients"}
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ background: "var(--rt-surface)" }}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden" style={{ background: "#ffffff" }}>
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader style={{ background: "#f9fafb" }}>
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>
                  Client Name
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>
                  Portal URL
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide text-right" style={{ color: "var(--rt-text-1)" }}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-destructive text-sm">
                    Failed to load clients. Make sure HRMS is running.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                    {search ? `No clients matching "${search}"` : "No clients found."}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((client) => {
                  const slug    = slugifyName(client.name);
                  const portalUrl = `${baseUrl}/portal/${slug}`;

                  return (
                    <TableRow key={client.id}>
                      {/* Name */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "var(--rt-accent-bg)" }}
                          >
                            <Building2 className="h-4 w-4" style={{ color: "var(--rt-accent)" }} />
                          </div>
                          <span className="font-medium text-sm" style={{ color: "var(--rt-text-1)" }}>
                            {client.name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Portal URL */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code
                            className="text-xs px-2 py-1 rounded font-mono break-all"
                            style={{
                              background: "var(--rt-accent-bg)",
                              color:      "var(--rt-accent)",
                            }}
                          >
                            /portal/{slug}
                          </code>
                          <CopyButton text={portalUrl} />
                          <a
                            href={portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open portal"
                            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                            style={{ color: "var(--rt-text-3)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "var(--rt-accent-bg)";
                              (e.currentTarget as HTMLElement).style.color      = "var(--rt-accent)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color      = "var(--rt-text-3)";
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Link
                          to={`/tickets?clientId=${client.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                          style={{
                            color:      "var(--rt-accent)",
                            background: "var(--rt-accent-bg)",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                        >
                          <Tickets className="h-3.5 w-3.5" />
                          View Tickets
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && !isError && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: "var(--rt-text-3)" }}>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} clients
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: "1px solid var(--rt-border)", background: "var(--rt-surface)" }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: "var(--rt-text-2)" }} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: p === currentPage ? "var(--rt-accent)"    : "var(--rt-surface)",
                  color:      p === currentPage ? "#ffffff"              : "var(--rt-text-2)",
                  border:     `1px solid ${p === currentPage ? "var(--rt-accent)" : "var(--rt-border)"}`,
                }}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: "1px solid var(--rt-border)", background: "var(--rt-surface)" }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: "var(--rt-text-2)" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
