"use client";

import { useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/role-labels";
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
import { Badge } from "@/components/ui/badge";
import { createUser, updateUser, deleteUser, uploadUserImage, removeUserImage } from "./actions";
import { OrgAvatar } from "@/app/(app)/organization/org-avatar";
import { Camera, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  image: string | null;
  role: Role;
  positions: {
    position: { id: string; name: string; department: { name: string } };
  }[];
};

function AvatarCell({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await uploadUserImage(user.id, formData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Αποτυχία μεταφόρτωσης");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="group relative w-fit">
      <OrgAvatar user={user} size="lg" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Αλλαγή φωτογραφίας"
        className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background disabled:opacity-50"
      >
        <Camera className="size-3" />
      </button>
      {user.image && (
        <button
          type="button"
          onClick={() => removeUserImage(user.id)}
          title="Αφαίρεση φωτογραφίας"
          className="absolute -top-1 -right-1 hidden size-5 items-center justify-center rounded-full bg-destructive text-white shadow ring-2 ring-background group-hover:flex"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

type Position = {
  id: string;
  name: string;
  department: { name: string };
};

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

export function UsersClient({
  users,
  positions,
  currentRole,
}: {
  users: User[];
  positions: Position[];
  currentRole: Role;
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const editing = editId ? users.find((u) => u.id === editId) : null;
  const canSetSuperAdmin = currentRole === "SUPER_ADMIN";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const positionIds = formData.getAll("positionIds") as string[];
    formData.delete("positionIds");
    positionIds.forEach((id) => formData.append("positionIds", id));
    try {
      if (editId) {
        await updateUser(editId, formData);
        setEditId(null);
      } else {
        await createUser(formData);
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
      await deleteUser(deleteId);
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
              <TableHead className="w-[70px]">Φωτο</TableHead>
              <TableHead>Όνομα</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ρόλος</TableHead>
              <TableHead>Θέσεις Εργασίας</TableHead>
              <TableHead className="w-[120px]">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell><AvatarCell user={u} /></TableCell>
                <TableCell>{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      u.role === "SUPER_ADMIN"
                        ? "destructive"
                        : u.role === "ADMIN"
                          ? "info"
                          : u.role === "MANAGER"
                            ? "warning"
                            : "secondary"
                    }
                  >
                    {roleLabel(u.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.positions.length
                    ? u.positions.map((p) => p.position.name).join(", ")
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditId(u.id);
                        setOpen(true);
                      }}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(u.id)}
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
          <Button onClick={() => setOpen(true)}>Δημιουργία χρήστη</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Επεξεργασία χρήστη" : "Δημιουργία χρήστη"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Όνομα</Label>
                <Input id="firstName" name="firstName" defaultValue={editing?.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Επώνυμο</Label>
                <Input id="lastName" name="lastName" defaultValue={editing?.lastName} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editing?.email}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{editId ? "Νέος κωδικός (αφήστε κενό για διατήρηση)" : "Κωδικός"}</Label>
              <Input id="password" name="password" type="password" minLength={editId ? 0 : 8} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Τηλέφωνο</Label>
                <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Κινητό</Label>
                <Input id="mobile" name="mobile" defaultValue={editing?.mobile ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Διεύθυνση</Label>
              <Input id="address" name="address" defaultValue={editing?.address ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Ρόλος</Label>
              <select
                name="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                defaultValue={editing?.role ?? "EMPLOYEE"}
              >
                {ROLES.filter((r) => r !== "SUPER_ADMIN" || canSetSuperAdmin).map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Θέσεις Εργασίας</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-2">
                {positions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="positionIds"
                      value={p.id}
                      defaultChecked={editing?.positions.some((up) => up.position.id === p.id)}
                      className="rounded border-input"
                    />
                    <span className="text-sm">
                      {p.name} ({p.department.name})
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
            <AlertDialogTitle>Διαγραφή χρήστη;</AlertDialogTitle>
            <AlertDialogDescription>
              Αυτό θα αφαιρέσει οριστικά τον χρήστη και τις αναθέσεις θέσεων εργασίας του.
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
