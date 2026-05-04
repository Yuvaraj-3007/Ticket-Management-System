import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { internalSubmitSchema, type InternalSubmitInput, INTERNAL_TICKET_TYPES, PRIORITIES } from "@tms/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EnumSelect } from "@/components/EnumSelect";
import { CheckCircle2 } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  BUG:         "Bug",
  REQUIREMENT: "Requirement",
  TASK:        "Task",
  SUPPORT:     "Support",
  EXPLANATION: "Explanation",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW:      "Low",
  MEDIUM:   "Medium",
  HIGH:     "High",
  CRITICAL: "Critical",
};

export default function InternalSubmit() {
  const navigate  = useNavigate();
  const [done, setDone] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<InternalSubmitInput>({
    resolver: zodResolver(internalSubmitSchema),
    defaultValues: { type: "SUPPORT", priority: "MEDIUM" },
  });

  const mutation = useMutation({
    mutationFn: (data: InternalSubmitInput) =>
      axios.post("/api/internal/tickets", data).then((r) => r.data),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--rt-bg)" }}>
        <div className="bg-white rounded-2xl shadow-sm border border-border p-10 text-center max-w-md w-full">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Ticket Submitted</h2>
          <p className="text-muted-foreground text-sm mb-6">Your ticket has been submitted and will be picked up by the team.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setDone(false)}>Submit Another</Button>
            <Button onClick={() => navigate("/internal/tickets")}>View My Tickets</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--rt-bg)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Submit Internal Ticket</h1>
          <p className="text-muted-foreground text-sm mt-1">Raise a ticket for the support team. You can track it under My Tickets.</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-white rounded-2xl shadow-sm border border-border p-6 space-y-5">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" placeholder="Brief summary of the issue" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <EnumSelect
                value={watch("type")}
                options={INTERNAL_TICKET_TYPES}
                labels={TYPE_LABELS}
                onValueChange={(v) => setValue("type", v as InternalSubmitInput["type"])}
                width="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <EnumSelect
                value={watch("priority")}
                options={PRIORITIES}
                labels={PRIORITY_LABELS}
                onValueChange={(v) => setValue("priority", v as InternalSubmitInput["priority"])}
                width="w-full"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail…"
              rows={6}
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">Failed to submit ticket. Please try again.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/internal/tickets")}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Submit Ticket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
