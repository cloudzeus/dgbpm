"use client";

import { useRef, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createLookupList,
  updateLookupList,
  deleteLookupList,
  importLookupItems,
} from "./actions";
import { ArrowUp, ArrowDown, Trash2, Upload, Loader2, Pencil } from "lucide-react";

type LookupItem = { id: string; value: string; label: string; order: number };

type LookupList = {
  id: string;
  name: string;
  description: string | null;
  items: LookupItem[];
  _count: { fields: number };
};

type ItemInput = { rowId: string; value: string; label: string };

export function LookupListsClient({ lists }: { lists: LookupList[] }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemInput[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setItems([]);
    setEditId(null);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(list: LookupList) {
    setEditId(list.id);
    setName(list.name);
    setDescription(list.description ?? "");
    setItems(
      list.items.map((it) => ({
        rowId: crypto.randomUUID(),
        value: it.value,
        label: it.label,
      }))
    );
    setFormError(null);
    setOpen(true);
  }

  function addItem() {
    setItems((prev) => [...prev, { rowId: crypto.randomUUID(), value: "", label: "" }]);
  }

  function updateItem(index: number, updates: Partial<ItemInput>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveItem(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const rows = await importLookupItems(formData);
      setItems((prev) => [
        ...prev,
        ...rows.map((r) => ({ rowId: crypto.randomUUID(), value: r.value, label: r.label })),
      ]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Αποτυχία εισαγωγής αρχείου.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const payloadItems = items
        .map((it) => ({ value: it.value.trim(), label: it.label.trim() }))
        .filter((it) => it.value !== "");
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        items: payloadItems,
      };
      if (editId) {
        await updateLookupList(editId, data);
      } else {
        await createLookupList(data);
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setLoading(true);
    setDeleteError(null);
    try {
      await deleteLookupList(deleteId);
      setDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Αποτυχία διαγραφής.");
    } finally {
      setLoading(false);
    }
  }

  const columns: DataTableColumn<LookupList>[] = [
    {
      key: "name",
      header: "Όνομα",
      cell: (list) => <span className="font-medium">{list.name}</span>,
    },
    {
      key: "description",
      header: "Περιγραφή",
      hideable: true,
      cell: (list) => (
        <span className="text-muted-foreground">{list.description ?? "—"}</span>
      ),
    },
    {
      key: "items",
      header: "Τιμές",
      align: "right",
      cell: (list) => list.items.length,
    },
    {
      key: "usage",
      header: "Χρήση",
      align: "right",
      cell: (list) =>
        list._count.fields > 0 ? `${list._count.fields} πεδία` : "—",
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={lists}
        rowKey={(list) => list.id}
        columnToggle
        emptyMessage="Δεν υπάρχουν λίστες τιμών ακόμη."
        actions={(list) => [
          {
            label: "Επεξεργασία",
            icon: <Pencil className="size-4" />,
            onSelect: () => openEdit(list),
          },
          {
            label: "Διαγραφή",
            icon: <Trash2 className="size-4" />,
            destructive: true,
            separatorBefore: true,
            onSelect: () => {
              setDeleteError(null);
              setDeleteId(list.id);
            },
          },
        ]}
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button onClick={openCreate}>Νέα λίστα</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Επεξεργασία λίστας τιμών" : "Νέα λίστα τιμών"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="space-y-3">
              <div className="space-y-2">
                <Label>Όνομα</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="π.χ. Τμήματα εταιρείας"
                />
              </div>
              <div className="space-y-2">
                <Label>Περιγραφή</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Σύντομη περιγραφή αυτής της λίστας"
                  rows={2}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-foreground">Τιμές</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="gap-1.5"
                  >
                    {importing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {importing ? "Εισαγωγή..." : "Εισαγωγή Excel"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleImport}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    Προσθήκη τιμής
                  </Button>
                </div>
              </div>
              <div className="rounded-md border">
                {items.length === 0 ? (
                  <p className="text-muted-foreground text-sm p-4">
                    Καμία τιμή ακόμη. Προσθέστε μία ή κάντε εισαγωγή από αρχείο Excel (στήλες value/label).
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Τιμή (value)</TableHead>
                        <TableHead>Ετικέτα (label)</TableHead>
                        <TableHead className="text-right">Σειρά</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, index) => (
                        <TableRow key={it.rowId}>
                          <TableCell>
                            <Input
                              value={it.value}
                              onChange={(e) => updateItem(index, { value: e.target.value })}
                              placeholder="value"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={it.label}
                              onChange={(e) => updateItem(index, { label: e.target.value })}
                              placeholder="label"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => moveItem(index, -1)}
                                disabled={index === 0}
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => moveItem(index, 1)}
                                disabled={index === items.length - 1}
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </section>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

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

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteId(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή λίστας τιμών;</AlertDialogTitle>
            <AlertDialogDescription>
              Αυτή η ενέργεια δεν μπορεί να αναιρεθεί. Οι λίστες που χρησιμοποιούνται σε πρότυπο δεν μπορούν να διαγραφούν.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={loading}
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
