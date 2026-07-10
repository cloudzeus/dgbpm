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
import { createJobPosition, updateJobPosition, deleteJobPosition } from "./actions";

type Position = {
  id: string;
  name: string;
  departmentId: string;
  managerId: string | null;
  department: { name: string; id: string };
  manager: { id: string; firstName: string; lastName: string; email: string } | null;
};

export function PositionsClient({
  positions,
  departments,
  users,
}: {
  positions: Position[];
  departments: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string; email: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const editing = editId ? positions.find((p) => p.id === editId) : null;

  const columns: DataTableColumn<Position>[] = [
    { key: "name", header: "Όνομα", cell: (p) => p.name },
    { key: "department", header: "Τμήμα", cell: (p) => p.department.name },
    {
      key: "manager",
      header: "Προϊστάμενος",
      cell: (p) =>
        p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "—",
    },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      if (editId) {
        await updateJobPosition(editId, formData);
        setEditId(null);
      } else {
        await createJobPosition(formData);
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
      await deleteJobPosition(deleteId);
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
        data={positions}
        rowKey={(p) => p.id}
        columnToggle
        actions={(p) => [
          {
            label: "Επεξεργασία",
            onSelect: () => {
              setEditId(p.id);
              setOpen(true);
            },
          },
          {
            label: "Διαγραφή",
            destructive: true,
            separatorBefore: true,
            onSelect: () => setDeleteId(p.id),
          },
        ]}
        toolbar={
          <Button onClick={() => setOpen(true)}>
            Δημιουργία θέσης εργασίας
          </Button>
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
            <DialogTitle>{editId ? "Επεξεργασία θέσης εργασίας" : "Δημιουργία θέσης εργασίας"}</DialogTitle>
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
              <Label>Τμήμα</Label>
              <select
                name="departmentId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                defaultValue={editing?.departmentId}
                required
              >
                <option value="">Επιλέξτε τμήμα</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Προϊστάμενος</Label>
              <select
                name="managerId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                defaultValue={editing?.managerId ?? ""}
              >
                <option value="">Κανένας</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
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
            <AlertDialogTitle>Διαγραφή θέσης εργασίας;</AlertDialogTitle>
            <AlertDialogDescription>
              Αυτό θα αφαιρέσει τη θέση εργασίας. Οι χρήστες που έχουν ανατεθεί σε αυτήν ενδέχεται να επηρεαστούν.
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
