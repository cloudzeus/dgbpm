"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  Camera,
  Plus,
  Save,
  X,
  Loader2,
  Mail,
  Phone,
  Smartphone,
  MapPin,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { roleLabel } from "@/lib/role-labels";
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
import { createUser, updateUser, deleteUser, uploadUserImage, removeUserImage } from "./actions";
import { OrgAvatar } from "@/app/(app)/organization/org-avatar";
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

type Position = {
  id: string;
  name: string;
  department: { name: string };
};

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

const LS_KEY = "users-table-prefs-v2";

// ---- Role badge (DG-styled, dot indicator) ---------------------------------
const ROLE_STYLE: Record<Role, { variant: "destructive" | "info" | "warning" | "secondary"; dot: string }> = {
  SUPER_ADMIN: { variant: "destructive", dot: "bg-red-500" },
  ADMIN: { variant: "info", dot: "bg-sky-500" },
  MANAGER: { variant: "warning", dot: "bg-amber-500" },
  EMPLOYEE: { variant: "secondary", dot: "bg-muted-foreground/50" },
};

function RoleBadge({ role }: { role: Role }) {
  const s = ROLE_STYLE[role];
  return (
    <Badge variant={s.variant} className="gap-1.5 px-2 py-0 text-[11px] font-medium">
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {roleLabel(role)}
    </Badge>
  );
}

// ---- Avatar with upload/remove --------------------------------------------
function AvatarUploader({ user, size = "md" }: { user: User; size?: "sm" | "md" | "lg" }) {
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
      <OrgAvatar user={user} size={size} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Αλλαγή φωτογραφίας"
        className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-2.5 animate-spin" /> : <Camera className="size-2.5" />}
      </button>
      {user.image && (
        <button
          type="button"
          onClick={() => removeUserImage(user.id)}
          title="Αφαίρεση φωτογραφίας"
          className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-destructive text-white shadow ring-2 ring-background group-hover:flex"
        >
          <Trash2 className="size-2.5" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

// ---- Inline edit draft -----------------------------------------------------
type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  mobile: string;
  address: string;
  role: Role;
  positionIds: Set<string>;
};

function draftFromUser(u: User): Draft {
  return {
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    password: "",
    phone: u.phone ?? "",
    mobile: u.mobile ?? "",
    address: u.address ?? "",
    role: u.role,
    positionIds: new Set(u.positions.map((p) => p.position.id)),
  };
}

export function UsersClient({
  users,
  positions,
  currentRole,
}: {
  users: User[];
  positions: Position[];
  currentRole: Role;
}) {
  const canSetSuperAdmin = currentRole === "SUPER_ADMIN";

  // -- expand + inline edit --
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const toggleExpand = useCallback((u: User) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(u.id)) next.delete(u.id);
      else {
        next.add(u.id);
        setDrafts((d) => (d[u.id] ? d : { ...d, [u.id]: draftFromUser(u) }));
      }
      return next;
    });
  }, []);

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function saveRow(id: string) {
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    const fd = new FormData();
    fd.set("firstName", d.firstName);
    fd.set("lastName", d.lastName);
    fd.set("email", d.email);
    if (d.password) fd.set("password", d.password);
    fd.set("phone", d.phone);
    fd.set("mobile", d.mobile);
    fd.set("address", d.address);
    fd.set("role", d.role);
    d.positionIds.forEach((pid) => fd.append("positionIds", pid));
    try {
      await updateUser(id, fd);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης");
    } finally {
      setSavingId(null);
    }
  }

  // -- create dialog + delete --
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createUser(fd);
      setCreateOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Αποτυχία δημιουργίας");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteUser(deleteId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Αποτυχία διαγραφής");
    } finally {
      setDeleteId(null);
    }
  }

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        key: "avatar",
        header: "Φωτο",
        width: 64,
        cell: (u) => <OrgAvatar user={u} size="sm" />,
      },
      {
        key: "name",
        header: "Ονοματεπώνυμο",
        width: 210,
        hideable: false,
        cell: (u) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {u.firstName} {u.lastName}
            </div>
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        width: 230,
        cell: (u) => <span className="truncate text-muted-foreground">{u.email}</span>,
      },
      {
        key: "role",
        header: "Ρόλος",
        width: 140,
        cell: (u) => <RoleBadge role={u.role} />,
      },
      {
        key: "positions",
        header: "Θέσεις εργασίας",
        width: 240,
        cell: (u) =>
          u.positions.length ? (
            <div className="flex flex-wrap gap-1">
              {u.positions.slice(0, 2).map((p, i) => (
                <Badge key={i} variant="outline" className="max-w-[140px] truncate px-1.5 py-0 text-[10px] font-normal">
                  {p.position.name}
                </Badge>
              ))}
              {u.positions.length > 2 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  +{u.positions.length - 2}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          ),
      },
      {
        key: "phone",
        header: "Τηλέφωνο",
        width: 130,
        cell: (u) => <span className="text-muted-foreground">{u.phone || "—"}</span>,
      },
      {
        key: "mobile",
        header: "Κινητό",
        width: 130,
        cell: (u) => <span className="text-muted-foreground">{u.mobile || "—"}</span>,
      },
    ],
    [],
  );

  return (
    <>
      <DataTable<User>
        columns={columns}
        data={users}
        rowKey={(u) => u.id}
        fullHeight
        resizable
        columnToggle
        searchable
        storageKey={LS_KEY}
        searchPlaceholder="Αναζήτηση χρήστη…"
        getSearchText={(u) =>
          [u.firstName, u.lastName, u.email, u.phone, u.mobile, roleLabel(u.role)].filter(Boolean).join(" ")
        }
        expandedKeys={expanded}
        onToggleExpand={toggleExpand}
        emptyMessage="Δεν βρέθηκαν χρήστες."
        toolbar={
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Νέος χρήστης
          </Button>
        }
        actions={(u) => [
          {
            label: "Επεξεργασία",
            icon: <Pencil className="size-3.5" />,
            onSelect: () => {
              if (!expanded.has(u.id)) toggleExpand(u);
            },
          },
          {
            label: "Διαγραφή",
            icon: <Trash2 className="size-3.5" />,
            destructive: true,
            separatorBefore: true,
            onSelect: () => setDeleteId(u.id),
          },
        ]}
        footer={(rows) =>
          `${rows.length} από ${users.length} χρήστες · Κάντε κλικ σε γραμμή για επεξεργασία inline.`
        }
        renderExpanded={(u) => {
          const draft = drafts[u.id];
          if (!draft) return null;
          const saving = savingId === u.id;
          return (
            <div className="animate-in fade-in slide-in-from-top-1 border-l-2 border-primary/60 px-5 py-4">
              <div className="flex flex-col gap-5 lg:flex-row">
                {/* photo */}
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <AvatarUploader user={u} size="lg" />
                  <span className="text-[10px] text-muted-foreground">Αλλαγή φωτο</span>
                </div>

                {/* fields */}
                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Όνομα">
                    <Input
                      className="h-8 text-xs"
                      value={draft.firstName}
                      onChange={(e) => patchDraft(u.id, { firstName: e.target.value })}
                    />
                  </Field>
                  <Field label="Επώνυμο">
                    <Input
                      className="h-8 text-xs"
                      value={draft.lastName}
                      onChange={(e) => patchDraft(u.id, { lastName: e.target.value })}
                    />
                  </Field>
                  <Field label="Ρόλος">
                    <select
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
                      value={draft.role}
                      onChange={(e) => patchDraft(u.id, { role: e.target.value as Role })}
                    >
                      {ROLES.filter((r) => r !== "SUPER_ADMIN" || canSetSuperAdmin).map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Email" icon={<Mail className="size-3" />}>
                    <Input
                      className="h-8 text-xs"
                      type="email"
                      value={draft.email}
                      onChange={(e) => patchDraft(u.id, { email: e.target.value })}
                    />
                  </Field>
                  <Field label="Τηλέφωνο" icon={<Phone className="size-3" />}>
                    <Input
                      className="h-8 text-xs"
                      value={draft.phone}
                      onChange={(e) => patchDraft(u.id, { phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Κινητό" icon={<Smartphone className="size-3" />}>
                    <Input
                      className="h-8 text-xs"
                      value={draft.mobile}
                      onChange={(e) => patchDraft(u.id, { mobile: e.target.value })}
                    />
                  </Field>
                  <Field label="Διεύθυνση" icon={<MapPin className="size-3" />} className="sm:col-span-2">
                    <Input
                      className="h-8 text-xs"
                      value={draft.address}
                      onChange={(e) => patchDraft(u.id, { address: e.target.value })}
                    />
                  </Field>
                  <Field label="Νέος κωδικός (προαιρετικό)">
                    <Input
                      className="h-8 text-xs"
                      type="password"
                      placeholder="Αφήστε κενό για διατήρηση"
                      value={draft.password}
                      onChange={(e) => patchDraft(u.id, { password: e.target.value })}
                    />
                  </Field>

                  {/* positions */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Briefcase className="size-3" />
                      Θέσεις εργασίας
                    </div>
                    <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto rounded-md border bg-background p-2.5">
                      {positions.map((p) => {
                        const checked = draft.positionIds.has(p.id);
                        return (
                          <label key={p.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = new Set(draft.positionIds);
                                if (v) next.add(p.id);
                                else next.delete(p.id);
                                patchDraft(u.id, { positionIds: next });
                              }}
                              className="size-3.5"
                            />
                            <span>
                              {p.name} <span className="text-muted-foreground">({p.department.name})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* actions */}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toggleExpand(u)}>
                  <X className="size-3.5" />
                  Κλείσιμο
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => saveRow(u.id)} disabled={saving}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Αποθήκευση
                </Button>
              </div>
            </div>
          );
        }}
      />

      {/* -------- Create dialog -------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Δημιουργία χρήστη</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-firstName">Όνομα</Label>
                <Input id="c-firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-lastName">Επώνυμο</Label>
                <Input id="c-lastName" name="lastName" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-password">Κωδικός</Label>
              <Input id="c-password" name="password" type="password" minLength={8} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Τηλέφωνο</Label>
                <Input id="c-phone" name="phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-mobile">Κινητό</Label>
                <Input id="c-mobile" name="mobile" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-address">Διεύθυνση</Label>
              <Input id="c-address" name="address" />
            </div>
            <div className="space-y-1.5">
              <Label>Ρόλος</Label>
              <select
                name="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                defaultValue="EMPLOYEE"
              >
                {ROLES.filter((r) => r !== "SUPER_ADMIN" || canSetSuperAdmin).map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Θέσεις εργασίας</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {positions.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" name="positionIds" value={p.id} className="rounded border-input" />
                    <span className="text-sm">
                      {p.name} <span className="text-muted-foreground">({p.department.name})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Άκυρο
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Δημιουργία…" : "Δημιουργία"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------- Delete confirm -------- */}
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
            <AlertDialogAction onClick={handleDelete}>Διαγραφή</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
