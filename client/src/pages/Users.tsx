import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios, { AxiosError } from "axios";
import {
  apiUsersSchema,
  editUserSchema,
  type ApiUser,
  type EditUserInput,
} from "@tms/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
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
  const [dialogError, setDialogError] = useState("");
  const [pageError, setPageError] = useState("");

  // Single form instance for both create and edit — editUserSchema covers both
  const form = useForm<UserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "AGENT" },
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

  const openCreateDialog = () => {
    setEditingUser(null);
    setDialogError("");
    form.reset({ name: "", email: "", password: "", role: "AGENT" });
    setDialogOpen(true);
  };

  const openEditDialog = (user: ApiUser) => {
    setEditingUser(user);
    setDialogError("");
    form.reset({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role as "ADMIN" | "AGENT",
    });
    setDialogOpen(true);
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
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>

          <div className="border rounded-lg">
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
            Failed to load users. Please refresh the page.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">User Management</h2>
          <Button onClick={openCreateDialog}>Add User</Button>
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

        <div className="border rounded-lg">
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
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No users found. Click "Add User" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "ADMIN" ? "default" : "secondary"}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? "default" : "destructive"}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant={user.isActive ? "destructive" : "outline"}
                        size="sm"
                        disabled={
                          toggleStatusMutation.isPending &&
                          toggleStatusMutation.variables?.id === user.id
                        }
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: user.id,
                            isActive: !user.isActive,
                          })
                        }
                      >
                        {toggleStatusMutation.isPending &&
                        toggleStatusMutation.variables?.id === user.id
                          ? "Saving..."
                          : user.isActive
                          ? "Deactivate"
                          : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setDialogError("");
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
            </DialogHeader>

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
                  {...form.register("email")}
                  className={
                    form.formState.errors.email ? "border-destructive" : ""
                  }
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
                  {editingUser ? " (leave blank to keep current)" : ""}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={editingUser ? "••••••••" : "Min 8 characters"}
                  {...form.register("password")}
                  className={
                    form.formState.errors.password ? "border-destructive" : ""
                  }
                />
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
                    if (val === null) return;
                    form.setValue("role", val as "ADMIN" | "AGENT", {
                      shouldValidate: true,
                    });
                  }}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AGENT">Agent</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
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
                    : editingUser
                    ? "Update User"
                    : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default Users;
