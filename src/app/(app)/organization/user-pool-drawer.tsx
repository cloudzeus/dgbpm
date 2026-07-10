"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OrgAvatar, type OrgUser } from "./org-avatar";

function DraggableUser({ user, dimmed }: { user: OrgUser; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `user:${user.id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("flex cursor-grab items-center gap-2 rounded-md border bg-card p-2", dimmed && "opacity-50", isDragging && "opacity-40")}
    >
      <OrgAvatar user={user} size="sm" />
      <span className="text-sm">{user.firstName} {user.lastName}</span>
    </div>
  );
}

export function UserPoolDrawer({
  open,
  onOpenChange,
  users,
  assignedUserIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: OrgUser[];
  assignedUserIds: Set<string>;
}) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72">
        <SheetHeader><SheetTitle>Ανάθεση χρηστών</SheetTitle></SheetHeader>
        <div className="space-y-2 p-4">
          <Input placeholder="🔍 Αναζήτηση" value={q} onChange={(e) => setQ(e.target.value)} />
          <p className="ui-meta">Σύρε έναν χρήστη πάνω σε μια θέση.</p>
          <div className="space-y-1.5">
            {filtered.map((u) => (
              <DraggableUser key={u.id} user={u} dimmed={assignedUserIds.has(u.id)} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UserPickerDialog({
  open,
  onOpenChange,
  users,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: OrgUser[];
  title: string;
  onPick: (userId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="px-4 pt-4"><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Command>
          <CommandInput placeholder="Αναζήτηση χρήστη…" />
          <CommandList>
            <CommandEmpty>Κανένας χρήστης.</CommandEmpty>
            {users.map((u) => (
              <CommandItem key={u.id} value={`${u.firstName} ${u.lastName} ${u.email}`} onSelect={() => { onPick(u.id); onOpenChange(false); }}>
                <OrgAvatar user={u} size="sm" />
                <span className="ml-2">{u.firstName} {u.lastName}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
