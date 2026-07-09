"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startProcessInstance } from "./actions";
import { ProcessInstancesAccordion, type ProcessInstanceWithTasks } from "./process-instances-accordion";

type Template = {
  id: string;
  name: string;
  icon: string;
};

export function ProcessInstancesClient({
  instances,
  allowedTemplates,
  currentUserId,
  isSuperOrAdmin,
}: {
  instances: ProcessInstanceWithTasks[];
  allowedTemplates: Template[];
  currentUserId: string;
  isSuperOrAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await startProcessInstance(formData);
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const defaultName =
    allowedTemplates.length > 0
      ? `${allowedTemplates[0]?.name ?? ""} – ${new Date().toISOString().slice(0, 16)}`
      : "";

  return (
    <>
      <ProcessInstancesAccordion
        instances={instances}
        currentUserId={currentUserId}
        isSuperOrAdmin={isSuperOrAdmin}
      />

      {allowedTemplates.length > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Νέα διαδικασία</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Έναρξη διαδικασίας</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Πρότυπο</Label>
                <select
                  name="processTemplateId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  required
                >
                  <option value="">Επιλέξτε πρότυπο</option>
                  {allowedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Όνομα διαδικασίας</Label>
                <Input
                  name="name"
                  defaultValue={defaultName}
                  placeholder="π.χ. Αίτημα Άδειας – 2025-02-18"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ημ/νία & ώρα έναρξης</Label>
                <Input
                  name="startDateTime"
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Άκυρο
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Έναρξη..." : "Έναρξη"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
