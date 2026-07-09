"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Τμήμα</TableHead>
              <TableHead>Προϊστάμενος</TableHead>
              <TableHead className="w-[120px]">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.department.name}</TableCell>
                <TableCell>
                  {p.manager
                    ? `${p.manager.firstName} ${p.manager.lastName}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditId(p.id);
                        setOpen(true);
                      }}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(p.id)}
                    >
                      Διαγραφή
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditId(null);
        }}
      >
        <DialogTrigger asChild>
          <Button onClick={() => setOpen(true)}>Δημιουργία θέσης εργασίας</Button>
        </DialogTrigger>
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
