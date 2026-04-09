// HRMS-POC API client
// Base URL: process.env.HRMS_API_URL (e.g. http://localhost:3000/api/v1)
// Auth: JWT Bearer token obtained via POST /auth/login

const HRMS_BASE     = process.env.HRMS_API_URL;
const HRMS_EMAIL    = process.env.HRMS_API_EMAIL;
const HRMS_PASSWORD = process.env.HRMS_API_PASSWORD;

let cachedToken: string | null = null;
let tokenExpiry = 0;

export interface HrmsClient {
  id:           string;
  customerCode: string;
  customerName: string;
}

export interface HrmsEmployee {
  id:    string;
  name:  string;
  email: string;
}

export interface HrmsProject {
  id:          string;
  projectCode: string;
  projectName: string;
}

async function getHrmsToken(): Promise<string | null> {
  if (!HRMS_BASE || !HRMS_EMAIL || !HRMS_PASSWORD) return null;
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  try {
    const res = await fetch(`${HRMS_BASE}/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: HRMS_EMAIL, password: HRMS_PASSWORD }),
    });
    if (!res.ok) throw new Error(`HRMS auth failed: ${res.status}`);
    const data = await res.json() as { access_token: string };
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // cache for 23h
    return cachedToken;
  } catch (err) {
    console.error("[hrms] Failed to authenticate:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Convert a customer name to a URL-safe slug
// e.g. "Fidelity Stockholm AB" → "fidelity-stockholm-ab"
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Get all active HRMS clients (for admin filter dropdown)
export async function getAllClients(): Promise<HrmsClient[]> {
  const token = await getHrmsToken();
  if (!token) return [];

  try {
    const res = await fetch(`${HRMS_BASE}/customers/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const customers = await res.json() as Array<{
      id:           string;
      customerCode: string;
      customerName: string;
      isActive:     boolean;
    }>;
    return customers
      .filter((c) => c.isActive !== false)
      .map((c) => ({ id: c.id, customerCode: c.customerCode, customerName: c.customerName }))
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  } catch (err) {
    console.error("[hrms] getAllClients error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// Find a client by slug (slug = slugified customerName)
// e.g. /portal/techvision-solutions → customerName "TechVision Solutions"
export async function getClientBySlug(slug: string): Promise<HrmsClient | null> {
  const token = await getHrmsToken();
  if (!token) return null;

  try {
    const res = await fetch(`${HRMS_BASE}/customers/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const customers = await res.json() as Array<{
      id:           string;
      customerCode: string;
      customerName: string;
      isActive:     boolean;
    }>;
    return (
      customers.find(
        (c) => c.isActive && (
          slugifyName(c.customerName) === slug.toLowerCase() ||
          c.customerCode.toLowerCase() === slug.toLowerCase()
        ),
      ) ?? null
    );
  } catch (err) {
    console.error("[hrms] getClientBySlug error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Get projects for a specific HRMS client (for portal project dropdown)
export async function getClientProjects(customerId: string): Promise<HrmsProject[]> {
  const token = await getHrmsToken();
  if (!token) return [];
  if (!/^[\w-]{1,128}$/.test(customerId)) return [];

  try {
    const res = await fetch(`${HRMS_BASE}/projects/by-customer/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const projects = await res.json() as Array<{
      id:          string;
      projectCode: string;
      projectName: string;
      status?:     string;
      isActive?:   boolean;
    }>;
    return projects
      .filter((p) => p.isActive !== false && p.status !== "INACTIVE")
      .map((p) => ({ id: p.id, projectCode: p.projectCode, projectName: p.projectName }));
  } catch (err) {
    console.error("[hrms] getClientProjects error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// Get employees assigned to a specific project (for filtered assignee dropdown)
export async function getProjectEmployees(projectId: string): Promise<HrmsEmployee[]> {
  const token = await getHrmsToken();
  if (!token) return [];
  if (!/^[\w-]{1,128}$/.test(projectId)) return [];

  try {
    const res = await fetch(`${HRMS_BASE}/projects/${projectId}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const employees = await res.json() as Array<{
      id:    string;
      user?: { firstName?: string; lastName?: string; email?: string };
    }>;
    return employees
      .map((e) => ({
        id:    e.id,
        name:  `${e.user?.firstName ?? ""} ${e.user?.lastName ?? ""}`.trim(),
        email: e.user?.email ?? "",
      }))
      .filter((e) => e.name && e.email);
  } catch (err) {
    console.error("[hrms] getProjectEmployees error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// Get employee directory for assignable dropdown
export async function getEmployeeDirectory(): Promise<HrmsEmployee[]> {
  const token = await getHrmsToken();
  if (!token) return [];

  try {
    const res = await fetch(`${HRMS_BASE}/employees/directory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const employees = await res.json() as Array<{
      id:       string;
      isActive: boolean;
      user?:    { firstName?: string; lastName?: string; email?: string };
    }>;
    return employees
      .filter((e) => e.isActive !== false)
      .map((e) => ({
        id:    e.id,
        name:  `${e.user?.firstName ?? ""} ${e.user?.lastName ?? ""}`.trim(),
        email: e.user?.email ?? "",
      }))
      .filter((e) => e.name && e.email);
  } catch (err) {
    console.error("[hrms] getEmployeeDirectory error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}
