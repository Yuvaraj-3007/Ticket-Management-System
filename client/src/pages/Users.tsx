import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios, { AxiosError } from "axios";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ROLES,
  apiUsersSchema,
  editUserSchema,
  type ApiUser,
  type EditUserInput,
  type UserRole,
} from "@tms/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

const API_URL = import.meta.env.VITE_API_URL || "";

type UserForm = EditUserInput;
type ServerErrorResponse = { fieldErrors?: Record<string, string[]>; error?: string };

function Users() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  // true when dialog is opened for an HRMS-only user (provision mode)
  const [isHrmsProvision, setIsHrmsProvision] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [pageError, setPageError] = useState("");
  // track which HRMS user's deactivate is in flight
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ApiUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Single form instance for both create and edit — editUserSchema covers both
  const form = useForm<UserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: "", email: "", password: "", role: ROLES.AGENT },
    mode: "onBlur",
  });

  const watchedRole = useWatch({ control: form.control, name: "role" });

  const { data: users = [], isLoading, isError } = useQuery<ApiUser[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/users`, {
        withCredentials: true,
      });
      return apiUsersSchema.parse(res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: UserForm) =>
      axios.post(`${API_URL}/api/users`, data, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setIsHrmsProvision(false);
    },
    onError: (err: AxiosError<ServerErrorResponse>) => {
      const fieldErrors = err.response?.data?.fieldErrors;
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([key, messages]) => {
          form.setError(key as keyof UserForm, {
            type: "server",
            message: Array.isArray(messages) ? messages[0] : String(messages),
          });
        });
      } else {
        setDialogError(err.response?.data?.error || "Failed to create user");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserForm }) =>
      axios.put(`${API_URL}/api/users/${id}`, data, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
    },
    onError: (err: AxiosError<ServerErrorResponse>) => {
      const fieldErrors = err.response?.data?.fieldErrors;
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([key, messages]) => {
          form.setError(key as keyof UserForm, {
            type: "server",
            message: Array.isArray(messages) ? messages[0] : String(messages),
          });
        });
      } else {
        setDialogError(err.response?.data?.error || "Failed to update user");
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(
        `${API_URL}/api/users/${id}/status`,
        { isActive },
        { withCredentials: true }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: AxiosError<ServerErrorResponse>) => {
      setPageError(err.response?.data?.error || "Failed to update status");
    },
  });

  // Provisions an HRMS-only user into TMS with a random password, then deactivates them
  const provisionAndDeactivateMutation = useMutation({
    mutationFn: async (hrmsUser: ApiUser) => {
      const createRes = await axios.post(
        `${API_URL}/api/users`,
        {
          name:     hrmsUser.name,
          email:    hrmsUser.email,
          password: crypto.randomUUID(),
          role:     ROLES.AGENT,
        },
        { withCredentials: true }
      );
      await axios.patch(
        `${API_URL}/api/users/${createRes.data.id}/status`,
        { isActive: false },
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setProvisioningId(null);
    },
    onError: (err: AxiosError<ServerErrorResponse>) => {
      setPageError(err.response?.data?.error || "Failed to deactivate user");
      setProvisioningId(null);
    },
  });


  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      axios.delete(`${API_URL}/api/users/${id}`, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteConfirmUser(null);
    },
    onError: (err: AxiosError<ServerErrorResponse>) => {
      setPageError(err.response?.data?.error || "Failed to delete user");
      setDeleteConfirmUser(null);
    },
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setIsHrmsProvision(false);
    setDialogError("");
    form.reset({ name: "", email: "", password: "", role: ROLES.AGENT });
    setDialogOpen(true);
  };

  const openEditDialog = (user: ApiUser) => {
    setDialogError("");
    if (user.source === "HRMS") {
      // Provision mode — opens create dialog pre-filled with HRMS data
      setIsHrmsProvision(true);
      setEditingUser(null);
      form.reset({ name: user.name, email: user.email, password: "", role: ROLES.AGENT });
      setDialogOpen(true);
      return;
    }
    setIsHrmsProvision(false);
    setEditingUser(user);
    form.reset({
      name:     user.name,
      email:    user.email,
      password: "",
      role:     user.role as UserRole,
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = (user: ApiUser) => {
    if (user.source === "HRMS") {
      // HRMS-only users must be provisioned first, then deactivated
      setProvisioningId(user.id);
      provisionAndDeactivateMutation.mutate(user);
      return;
    }
    toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive });
  };

  const onSubmit = (data: UserForm) => {
    if (editingUser) {
      setDialogError("");
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      // Password is required for create — enforce since the shared schema makes it optional
      if (!data.password) {
        form.setError("password", {
          type: "manual",
          message: "Password is required",
        });
        return;
      }
      setDialogError("");
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-16 rounded" />
                        <Skeleton className="h-8 w-20 rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
          Failed to load users. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--rt-text-1)" }}>Users</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--rt-text-3)" }}>Manage team members and their access roles</p>
          </div>
          <Button onClick={openCreateDialog} style={{ background: "var(--rt-accent)", color: "#fff" }}>Add User</Button>
        </div>

        {pageError && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4 flex items-center justify-between">
            <span>{pageError}</span>
            <button
              onClick={() => setPageError("")}
              className="text-destructive hover:text-destructive/80 ml-2 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}


        <div className="mb-4">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader style={{ background: "var(--rt-surface-2)" }}>
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Email</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Role</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Status</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Created</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wide text-right" style={{ color: "var(--rt-text-1)" }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const filtered = search.trim()
                  ? users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))
                  : users;
                const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

                if (filtered.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {search ? `No users match "${search}".` : `No users found. Click "Add User" to create one.`}
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <>
                    {paginated.map((user) => {
                      const isTogglingThis =
                        (toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === user.id) ||
                        (provisionAndDeactivateMutation.isPending && provisioningId === user.id);

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Link to={`/users/${user.id}`} className="font-medium hover:underline" style={{ color: "var(--rt-accent)" }}>
                              {user.name}
                            </Link>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === ROLES.ADMIN ? "default" : "secondary"}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "destructive"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                                Edit
                              </Button>
                              <Button
                                variant={user.isActive ? "destructive" : "outline"}
                                size="sm"
                                disabled={isTogglingThis}
                                onClick={() => handleToggleStatus(user)}
                              >
                                {isTogglingThis ? "Saving..." : user.isActive ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                                onClick={() => setDeleteConfirmUser(user)}
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {totalPages > 1 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs text-muted-foreground">
                              {filtered.length} users · page {page} of {totalPages}
                            </span>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                                Previous
                              </Button>
                              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                                Next
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })()}
            </TableBody>
          </Table>
          </div>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setDialogError("");
              setIsHrmsProvision(false);
              setShowPassword(false);
            }
          }}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isHrmsProvision
                  ? "Add HRMS Employee to System"
                  : editingUser
                  ? "Edit User"
                  : "Add New User"}
              </DialogTitle>
            </DialogHeader>

            {isHrmsProvision && (
              <p className="text-sm text-muted-foreground -mt-1">
                Set a password to create a Right Tracker account for this employee.
              </p>
            )}

            {dialogError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {dialogError}
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  {...form.register("name")}
                  className={
                    form.formState.errors.name ? "border-destructive" : ""
                  }
                />
                {form.formState.errors.name && (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  readOnly={isHrmsProvision}
                  {...form.register("email")}
                  className={[
                    form.formState.errors.email ? "border-destructive" : "",
                    isHrmsProvision ? "bg-muted cursor-not-allowed opacity-70" : "",
                  ].join(" ")}
                />
                {form.formState.errors.email && (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password
                  {editingUser && !isHrmsProvision ? " (leave blank to keep current)" : ""}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={editingUser && !isHrmsProvision ? "••••••••" : "Min 8 characters"}
                    {...form.register("password")}
                    className={`pr-9 ${form.formState.errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={watchedRole}
                  onValueChange={(val) => {
                    form.setValue("role", val as UserRole, {
                      shouldValidate: true,
                    });
                  }}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLES.AGENT}>Agent</SelectItem>
                    <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : isHrmsProvision
                    ? "Add to System"
                    : editingUser
                    ? "Update User"
                    : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        {/* Delete confirmation dialog */}
        <Dialog open={Boolean(deleteConfirmUser)} onOpenChange={(open) => { if (!open) setDeleteConfirmUser(null); }}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold">{deleteConfirmUser?.name}</span>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteConfirmUser && deleteMutation.mutate(deleteConfirmUser.id)}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

export default Users;
