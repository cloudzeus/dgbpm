"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DeptData } from "./organization-client";

const COLOR_SWATCHES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export type DepartmentMeta = {
  name: string;
  email: string | null;
  phoneNumber: string | null;
  color: string;
};

export function DepartmentEditDialog({
  department,
  open,
  onOpenChange,
  onSave,
}: {
  department: DeptData | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (id: string, meta: DepartmentMeta) => void;
}) {
  // State is derived from props at mount; the parent forces a remount via `key`
  // whenever the target department changes, so no syncing effect is needed.
  const [name, setName] = useState(department?.name ?? "");
  const [email, setEmail] = useState(department?.email ?? "");
  const [phone, setPhone] = useState(department?.phoneNumber ?? "");
  const [color, setColor] = useState(department?.color || COLOR_SWATCHES[0]);

  function submit() {
    if (!department || !name.trim()) return;
    onSave(department.id, {
      name: name.trim(),
      email: email.trim() || null,
      phoneNumber: phone.trim() || null,
      color,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Επεξεργασία τμήματος</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Όνομα</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-email">Email</Label>
            <Input id="dept-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-phone">Τηλέφωνο</Label>
            <Input id="dept-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Χρώμα</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 transition",
                    color === c && "ring-2 ring-foreground"
                  )}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Άκυρο</Button>
          <Button onClick={submit} disabled={!name.trim()}>Αποθήκευση</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
