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
  currentUserName,
  isSuperOrAdmin,
}: {
  instances: ProcessInstanceWithTasks[];
  allowedTemplates: Template[];
  currentUserId: string;
  currentUserName: string;
  isSuperOrAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Φιλικό default όνομα: «Πρότυπο — Χρήστης — ημερομηνία» αντί για κωδικό/timestamp.
  const buildName = (templateName: string) => {
    const date = new Date().toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const parts = [templateName, currentUserName, date].filter(Boolean);
    return parts.join(" — ");
  };

  const firstTemplate = allowedTemplates[0];
  const [templateId, setTemplateId] = useState(firstTemplate?.id ?? "");
  const [name, setName] = useState(
    firstTemplate ? buildName(firstTemplate.name) : ""
  );

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = allowedTemplates.find((t) => t.id === id);
    setName(tpl ? buildName(tpl.name) : "");
  };

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
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="π.χ. Αίτημα Άδειας — Γιάννης Κοζύρης — 18/02/2025"
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
