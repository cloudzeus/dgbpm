"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDepartment, updateDepartment, deleteDepartment } from "./actions";

const COLOR_SWATCHES = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

type Dept = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  parentId: string | null;
  color: string;
  parent: { name: string } | null;
  _count: { positions: number };
};

export function DepartmentsClient({
  departments,
  parentOptions,
}: {
  departments: Dept[];
  parentOptions: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const editing = editId ? departments.find((d) => d.id === editId) : null;

  const columns: DataTableColumn<Dept>[] = [
    {
      key: "name",
      header: "Όνομα",
      cell: (d) => (
        <>
          <span
            className="mr-2 inline-block size-3 rounded-full"
            style={{ backgroundColor: d.color }}
          />
          {d.name}
        </>
      ),
    },
    { key: "parent", header: "Γονικό", cell: (d) => d.parent?.name ?? "—" },
    { key: "email", header: "Email", cell: (d) => d.email ?? "—" },
    { key: "phoneNumber", header: "Τηλέφωνο", cell: (d) => d.phoneNumber ?? "—" },
    {
      key: "positions",
      header: "Θέσεις Εργασίας",
      cell: (d) => d._count.positions,
    },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      if (editId) {
        await updateDepartment(editId, formData);
        setEditId(null);
      } else {
        await createDepartment(formData);
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      await deleteDepartment(deleteId);
      setDeleteId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={departments}
        rowKey={(d) => d.id}
        columnToggle
        actions={(d) => [
          {
            label: "Επεξεργασία",
            onSelect: () => {
              setEditId(d.id);
              setOpen(true);
            },
          },
          {
            label: "Διαγραφή",
            destructive: true,
            separatorBefore: true,
            onSelect: () => setDeleteId(d.id),
          },
        ]}
        toolbar={
          <Button onClick={() => setOpen(true)}>Δημιουργία τμήματος</Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Επεξεργασία τμήματος" : "Δημιουργία τμήματος"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Όνομα</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editing?.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Τηλέφωνο</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                defaultValue={editing?.phoneNumber ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Γονικό τμήμα</Label>
              <select
                name="parentId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                defaultValue={editing?.parentId ?? ""}
              >
                <option value="">Κανένα</option>
                {parentOptions
                  .filter((p) => p.id !== editId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Χρώμα</Label>
              <input type="hidden" name="color" id="dept-color" defaultValue={editing?.color ?? COLOR_SWATCHES[0]} />
              <div className="flex gap-2 flex-wrap">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("dept-color") as HTMLInputElement;
                      if (el) el.value = c;
                    }}
                    className="size-8 rounded-md border-2 border-transparent hover:border-foreground"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Άκυρο
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Αποθήκευση..." : editId ? "Ενημέρωση" : "Δημιουργία"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή τμήματος;</AlertDialogTitle>
            <AlertDialogDescription>
              Αυτό θα αφαιρέσει το τμήμα. Οι θέσεις εργασίας που ανήκουν σε αυτό ενδέχεται να επηρεαστούν.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
