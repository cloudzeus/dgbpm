"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createLookupList,
  updateLookupList,
  deleteLookupList,
  addLookupListItem,
  updateLookupListHeaders,
  updateLookupListItem,
  deleteLookupListItem,
  analyzeLookupWorkbook,
  previewLookupImport,
  commitLookupImport,
  type CommitLookupImportResult,
} from "./actions";
import { treeOrder, withDescendants } from "@/lib/entities/tree";
import type { WorkbookSheetInfo } from "@/lib/entities/xlsx-mapping";
import {
  suggestLookupMapping,
  type LookupImportPlan,
  type ParentMatchMode,
} from "@/lib/lookup-lists/import-plan";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Upload,
  Loader2,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ListPlus,
  Check,
} from "lucide-react";

type LookupItem = {
  id: string;
  value: string;
  label: string;
  extra?: unknown;
  order: number;
  parentId: string | null;
};

type LookupColumn = { key: string; label: string };

function parseColumns(json: unknown): LookupColumn[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (c): c is LookupColumn =>
      !!c && typeof c === "object" && typeof (c as LookupColumn).key === "string" &&
      typeof (c as LookupColumn).label === "string"
  );
}

function parseExtra(json: unknown): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function newColumnKey() {
  return `c_${crypto.randomUUID().slice(0, 8)}`;
}

type LookupList = {
  id: string;
  name: string;
  description: string | null;
  valueHeader: string | null;
  labelHeader: string | null;
  extraColumns?: unknown;
  items: LookupItem[];
  _count: { fields: number };
};

/** Επικεφαλίδες στηλών της λίστας — προσαρμοσμένες ή γενικές. */
function listHeaders(list: { valueHeader: string | null; labelHeader: string | null }) {
  return {
    value: list.valueHeader?.trim() || "Τιμή (value)",
    label: list.labelHeader?.trim() || "Ετικέτα (label)",
  };
}

type ItemInput = {
  rowId: string;
  value: string;
  label: string;
  parentValue: string;
  extra: Record<string, string>;
};

const NO_PARENT = "__none__";

export function LookupListsClient({ lists }: { lists: LookupList[] }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarnings, setFormWarnings] = useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [quickAddList, setQuickAddList] = useState<LookupList | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [valueHeader, setValueHeader] = useState("");
  const [labelHeader, setLabelHeader] = useState("");
  const [extraCols, setExtraCols] = useState<LookupColumn[]>([]);
  const [items, setItems] = useState<ItemInput[]>([]);

  function resetForm() {
    setName("");
    setDescription("");
    setValueHeader("");
    setLabelHeader("");
    setExtraCols([]);
    setItems([]);
    setEditId(null);
    setFormError(null);
    setFormWarnings([]);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(list: LookupList) {
    setEditId(list.id);
    setName(list.name);
    setDescription(list.description ?? "");
    setValueHeader(list.valueHeader ?? "");
    setLabelHeader(list.labelHeader ?? "");
    setExtraCols(parseColumns(list.extraColumns));
    const valueById = new Map(list.items.map((it) => [it.id, it.value]));
    setItems(
      list.items.map((it) => ({
        rowId: crypto.randomUUID(),
        value: it.value,
        label: it.label,
        parentValue: (it.parentId && valueById.get(it.parentId)) || "",
        extra: parseExtra(it.extra),
      }))
    );
    setFormError(null);
    setOpen(true);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { rowId: crypto.randomUUID(), value: "", label: "", parentValue: "", extra: {} },
    ]);
  }

  function updateItem(rowId: string, updates: Partial<ItemInput>) {
    setItems((prev) => prev.map((it) => (it.rowId === rowId ? { ...it, ...updates } : it)));
  }

  function removeItem(rowId: string) {
    setItems((prev) => prev.filter((it) => it.rowId !== rowId));
  }

  function moveItem(rowId: string, dir: -1 | 1) {
    setItems((prev) => {
      const index = prev.findIndex((it) => it.rowId === rowId);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Δέντρο πάνω στα draft items: id = rowId, γονέας μέσω parentValue → rowId.
  const rowIdByValue = new Map<string, string>();
  for (const it of items) {
    const v = it.value.trim();
    if (v && !rowIdByValue.has(v)) rowIdByValue.set(v, it.rowId);
  }
  const treeNodes = items.map((it) => ({
    ...it,
    id: it.rowId,
    parentId: it.parentValue.trim() ? rowIdByValue.get(it.parentValue.trim()) ?? null : null,
  }));
  const orderedItems = treeOrder(treeNodes);

  /** Επιλογές γονέα για μια γραμμή: όλα εκτός από τον εαυτό της και τους απογόνους της. */
  function parentOptions(rowId: string) {
    const excluded = withDescendants(treeNodes, rowId);
    return orderedItems.filter(
      (o) => !excluded.has(o.rowId) && o.value.trim() !== "" && rowIdByValue.get(o.value.trim()) === o.rowId
    );
  }

  /** Ολοκλήρωση wizard: συγχρονισμός τοπικής φόρμας με ό,τι γράφτηκε στη ΒΔ. */
  function handleImported(result: CommitLookupImportResult) {
    setEditId(result.listId);
    setItems(
      result.items.map((r) => ({
        rowId: crypto.randomUUID(),
        value: r.value,
        label: r.label,
        parentValue: r.parentValue ?? "",
        extra: {},
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setFormWarnings([]);
    try {
      const payloadItems = items
        .map((it) => ({
          value: it.value.trim(),
          label: it.label.trim(),
          parentValue: it.parentValue.trim() || null,
          extra: it.extra,
        }))
        .filter((it) => it.value !== "");
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        valueHeader: valueHeader.trim() || null,
        labelHeader: labelHeader.trim() || null,
        extraColumns: extraCols.filter((c) => c.label.trim() !== ""),
        items: payloadItems,
      };
      let result: { warnings: string[] };
      if (editId) {
        result = await updateLookupList(editId, data);
      } else {
        const created = await createLookupList(data);
        setEditId(created.id); // επόμενο submit = update, όχι διπλή δημιουργία
        result = created;
      }
      if (result.warnings.length > 0) {
        setFormWarnings(result.warnings);
      } else {
        setOpen(false);
        resetForm();
      }
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
        expandedKeys={expanded}
        onToggleExpand={(list) =>
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(list.id)) next.delete(list.id);
            else next.add(list.id);
            return next;
          })
        }
        renderExpanded={(list) => <LookupItemsEditor list={list} />}
        actions={(list) => [
          {
            label: "Προσθήκη τιμής",
            icon: <ListPlus className="size-4" />,
            onSelect: () => setQuickAddList(list),
          },
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Επεξεργασία λίστας τιμών" : "Νέα λίστα τιμών"}</DialogTitle>
            <DialogDescription>
              Ορίστε τις τιμές της λίστας και, προαιρετικά, την ιεραρχία τους μέσω γονέα.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lookup-name">Όνομα</Label>
                <Input
                  id="lookup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="π.χ. Τμήματα εταιρείας"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lookup-description">Περιγραφή</Label>
                <Textarea
                  id="lookup-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Σύντομη περιγραφή αυτής της λίστας"
                  rows={2}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="ui-subsection-title">Στήλες</h3>
                  <p className="ui-meta">
                    Ορίστε τις στήλες της λίστας — ο πίνακας τιμών παρακάτω δημιουργείται από αυτές.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setExtraCols((prev) => [...prev, { key: newColumnKey(), label: "" }])
                  }
                >
                  Προσθήκη στήλης
                </Button>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-24 shrink-0 justify-center font-normal">
                    Κλειδί
                  </Badge>
                  <Input
                    value={valueHeader}
                    onChange={(e) => setValueHeader(e.target.value)}
                    placeholder="Όνομα στήλης-κλειδιού, π.χ. id"
                    className="h-8 text-xs"
                  />
                  <span className="ui-meta hidden w-56 shrink-0 sm:block">
                    Μοναδικός κωδικός κάθε εγγραφής
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-24 shrink-0 justify-center font-normal">
                    Εμφάνιση
                  </Badge>
                  <Input
                    value={labelHeader}
                    onChange={(e) => setLabelHeader(e.target.value)}
                    placeholder="Όνομα στήλης εμφάνισης, π.χ. Όνομα"
                    className="h-8 text-xs"
                  />
                  <span className="ui-meta hidden w-56 shrink-0 sm:block">
                    Αυτό βλέπει ο χρήστης στο dropdown
                  </span>
                </div>
                {extraCols.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-24 shrink-0 justify-center font-normal">
                      Στήλη {i + 3}
                    </Badge>
                    <Input
                      value={c.label}
                      onChange={(e) =>
                        setExtraCols((prev) =>
                          prev.map((x) => (x.key === c.key ? { ...x, label: e.target.value } : x))
                        )
                      }
                      placeholder="Όνομα στήλης, π.χ. Email"
                      className="h-8 text-xs"
                      autoFocus={c.label === ""}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setExtraCols((prev) => prev.filter((x) => x.key !== c.key));
                        // καθάρισμα τιμών της στήλης από τα draft items
                        setItems((prev) =>
                          prev.map((it) => {
                            const rest = { ...it.extra };
                            delete rest[c.key];
                            return { ...it, extra: rest };
                          })
                        );
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="ui-subsection-title">Τιμές</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWizardOpen(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Upload className="size-3.5" />
                    Εισαγωγή Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={addItem}
                  >
                    Προσθήκη τιμής
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                {items.length === 0 ? (
                  <p className="ui-body-muted p-4">
                    Καμία τιμή ακόμη. Προσθέστε μία ή κάντε εισαγωγή από αρχείο Excel (στήλες value/label και προαιρετικά «Γονικός Κωδικός»).
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead className="ui-eyebrow h-9">
                          {valueHeader.trim() || "Τιμή (value)"}
                        </TableHead>
                        <TableHead className="ui-eyebrow h-9">
                          {labelHeader.trim() || "Ετικέτα (label)"}
                        </TableHead>
                        {extraCols.map((c) => (
                          <TableHead key={c.key} className="ui-eyebrow h-9">
                            {c.label.trim() || "—"}
                          </TableHead>
                        ))}
                        <TableHead className="ui-eyebrow h-9 w-[170px]">Γονέας</TableHead>
                        <TableHead className="ui-eyebrow h-9 w-[88px] text-right">Σειρά</TableHead>
                        <TableHead className="h-9 w-[44px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderedItems.map((it) => {
                        const baseIndex = items.findIndex((x) => x.rowId === it.rowId);
                        return (
                          <TableRow key={it.rowId}>
                            <TableCell className="py-1.5">
                              <div className="flex items-center gap-1">
                                {it.depth > 0 && (
                                  <span className="ui-meta whitespace-nowrap">
                                    {"— ".repeat(it.depth)}
                                  </span>
                                )}
                                <Input
                                  value={it.value}
                                  onChange={(e) => updateItem(it.rowId, { value: e.target.value })}
                                  placeholder="value"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                value={it.label}
                                onChange={(e) => updateItem(it.rowId, { label: e.target.value })}
                                placeholder="label"
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            {extraCols.map((c) => (
                              <TableCell key={c.key} className="py-1.5">
                                <Input
                                  value={it.extra[c.key] ?? ""}
                                  onChange={(e) =>
                                    updateItem(it.rowId, {
                                      extra: { ...it.extra, [c.key]: e.target.value },
                                    })
                                  }
                                  placeholder={c.label.trim() || "—"}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                            ))}
                            <TableCell className="py-1.5">
                              <Select
                                value={it.parentValue.trim() || NO_PARENT}
                                onValueChange={(v) =>
                                  updateItem(it.rowId, { parentValue: v === NO_PARENT ? "" : v })
                                }
                              >
                                <SelectTrigger className="h-8 w-[160px] text-xs">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_PARENT}>— (καμία)</SelectItem>
                                  {parentOptions(it.rowId).map((o) => (
                                    <SelectItem key={o.rowId} value={o.value.trim()}>
                                      {"— ".repeat(o.depth)}
                                      {o.label.trim() || o.value.trim()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <div className="flex justify-end gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => moveItem(it.rowId, -1)}
                                  disabled={baseIndex <= 0}
                                >
                                  <ArrowUp className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => moveItem(it.rowId, 1)}
                                  disabled={baseIndex === items.length - 1}
                                >
                                  <ArrowDown className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(it.rowId)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </section>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            {formWarnings.length > 0 && (
              <div className="flex gap-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="ui-body font-medium text-amber-800 dark:text-amber-300">
                    Αποθηκεύτηκε με {formWarnings.length}{" "}
                    {formWarnings.length === 1 ? "προειδοποίηση" : "προειδοποιήσεις"}
                  </p>
                  <p className="ui-meta text-amber-700 dark:text-amber-400/80">
                    {formWarnings.slice(0, 5).join(" · ")}
                    {formWarnings.length > 5 && ` · … και ${formWarnings.length - 5} ακόμη`}
                  </p>
                </div>
              </div>
            )}

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

      <QuickAddItemDialog list={quickAddList} onClose={() => setQuickAddList(null)} />

      <LookupImportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        listId={editId}
        listName={name}
        listDescription={description}
        onImported={handleImported}
      />

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

// ---------------------------------------------------------------------------
// Expanded row: επεξεργάσιμος πίνακας τιμών (inline edit label/value + διαγραφή).

/** Επικεφαλίδα στήλης με inline επεξεργασία (κλικ → input → Enter/blur = αποθήκευση). */
function EditableHeader({
  current,
  fallback,
  onSave,
}: {
  current: string | null;
  fallback: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function commit() {
    setEditing(false);
    if (draft.trim() === (current ?? "").trim()) return;
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={fallback}
        className="h-7 max-w-40 text-xs"
      />
    );
  }
  return (
    <button
      type="button"
      className="ui-eyebrow group flex items-center gap-1 hover:text-foreground"
      title="Κλικ για μετονομασία στήλης"
      onClick={() => {
        setDraft(current ?? "");
        setEditing(true);
      }}
      disabled={busy}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : null}
      {current?.trim() || fallback}
      <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}

function LookupItemsEditor({ list }: { list: LookupList }) {
  if (list.items.length === 0) {
    return <p className="ui-body-muted px-4 py-3">Καμία τιμή ακόμη.</p>;
  }
  const ordered = treeOrder(list.items);
  const labelById = new Map(list.items.map((it) => [it.id, it.label || it.value]));
  const cols = parseColumns(list.extraColumns);
  return (
    <div className="px-4 py-3">
      <div className="max-h-80 overflow-x-auto overflow-y-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="h-9">
                <EditableHeader
                  current={list.labelHeader}
                  fallback="Ετικέτα (label)"
                  onSave={(v) => updateLookupListHeaders(list.id, { labelHeader: v })}
                />
              </TableHead>
              <TableHead className="h-9">
                <EditableHeader
                  current={list.valueHeader}
                  fallback="Τιμή (value)"
                  onSave={(v) => updateLookupListHeaders(list.id, { valueHeader: v })}
                />
              </TableHead>
              {cols.map((c) => (
                <TableHead key={c.key} className="ui-eyebrow h-9">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="ui-eyebrow h-9">Γονέας</TableHead>
              <TableHead className="h-9 w-[88px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((node) => (
              <EditableItemRow
                key={`${node.id}:${node.value}:${node.label}:${JSON.stringify(node.extra ?? null)}`}
                item={node}
                cols={cols}
                depth={node.depth}
                parentLabel={node.parentId ? labelById.get(node.parentId) ?? "—" : "—"}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EditableItemRow({
  item,
  cols,
  depth,
  parentLabel,
}: {
  item: LookupItem;
  cols: LookupColumn[];
  depth: number;
  parentLabel: string;
}) {
  const initialExtra = parseExtra(item.extra);
  const [label, setLabel] = useState(item.label);
  const [value, setValue] = useState(item.value);
  const [extra, setExtra] = useState<Record<string, string>>(initialExtra);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty =
    label !== item.label ||
    value !== item.value ||
    JSON.stringify(extra) !== JSON.stringify(initialExtra);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await updateLookupListItem(item.id, { value, label, extra });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Διαγραφή της τιμής «${item.label || item.value}»;`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLookupListItem(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία διαγραφής.");
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="py-1.5">
        <div className="flex items-center gap-1">
          {depth > 0 && (
            <span className="ui-meta whitespace-nowrap">{"— ".repeat(depth)}</span>
          )}
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-8 max-w-72 text-xs"
            disabled={busy}
          />
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
      <TableCell className="py-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 max-w-48 text-xs"
          disabled={busy}
        />
      </TableCell>
      {cols.map((c) => (
        <TableCell key={c.key} className="py-1.5">
          <Input
            value={extra[c.key] ?? ""}
            onChange={(e) => setExtra((prev) => ({ ...prev, [c.key]: e.target.value }))}
            placeholder="—"
            className="h-8 max-w-48 text-xs"
            disabled={busy}
          />
        </TableCell>
      ))}
      <TableCell className="py-1.5 text-muted-foreground">{parentLabel}</TableCell>
      <TableCell className="py-1.5 text-right">
        <div className="flex justify-end gap-0.5">
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-emerald-600 hover:text-emerald-700"
              onClick={handleSave}
              disabled={busy || value.trim() === ""}
              title="Αποθήκευση"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={busy}
            title="Διαγραφή"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Γρήγορη καταχώρηση μίας τιμής σε υπάρχουσα λίστα (row action).

function QuickAddItemDialog({
  list,
  onClose,
}: {
  list: LookupList | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [parentValue, setParentValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastListId, setLastListId] = useState<string | null>(null);

  // Καθάρισμα φόρμας όταν ανοίγει για άλλη λίστα.
  if (list && list.id !== lastListId) {
    setLastListId(list.id);
    setValue("");
    setLabel("");
    setExtra({});
    setParentValue("");
    setError(null);
  }

  const quickCols = list ? parseColumns(list.extraColumns) : [];

  const parentTree = list ? treeOrder(list.items) : [];
  const headers = list ? listHeaders(list) : { value: "Τιμή (value)", label: "Ετικέτα (label)" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      const { warnings } = await addLookupListItem(list.id, {
        value,
        label,
        parentValue: parentValue.trim() || null,
        extra,
      });
      if (warnings.length > 0) {
        setError(warnings.join(" · "));
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία καταχώρησης.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Προσθήκη τιμής</DialogTitle>
          <DialogDescription>
            Νέα τιμή στη λίστα «{list?.name}».
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-value">{headers.value}</Label>
            <Input
              id="quick-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              placeholder="π.χ. laptop"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-label">{headers.label}</Label>
            <Input
              id="quick-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="π.χ. Φορητός υπολογιστής"
            />
          </div>
          {quickCols.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label htmlFor={`quick-extra-${c.key}`}>{c.label}</Label>
              <Input
                id={`quick-extra-${c.key}`}
                value={extra[c.key] ?? ""}
                onChange={(e) => setExtra((prev) => ({ ...prev, [c.key]: e.target.value }))}
              />
            </div>
          ))}
          {parentTree.length > 0 && (
            <div className="space-y-1.5">
              <Label>Γονέας</Label>
              <Select
                value={parentValue || NO_PARENT}
                onValueChange={(v) => setParentValue(v === NO_PARENT ? "" : v)}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>— (καμία)</SelectItem>
                  {parentTree.map((o) => (
                    <SelectItem key={o.id} value={o.value}>
                      {"— ".repeat(o.depth)}
                      {o.label || o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Άκυρο
            </Button>
            <Button type="submit" disabled={busy || value.trim() === ""}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Καταχώρηση
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Wizard εισαγωγής Excel 3 βημάτων: Αρχείο → Αντιστοίχιση → Προεπισκόπηση.

const NO_COLUMN = "__none__";

type WizardStep = "file" | "map" | "preview" | "done";

const PARENT_MATCH_LABEL: Record<ParentMatchMode, string> = {
  auto: "Αυτόματα (προτείνεται)",
  value: "Τιμή (κωδικό)",
  label: "Ετικέτα (όνομα)",
};

function StatChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5">
      <span className="ui-data font-semibold tabular-nums">{count}</span>
      <span className="ui-meta">{label}</span>
    </div>
  );
}

function LookupImportWizard({
  open,
  onOpenChange,
  listId,
  listName,
  listDescription,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listId: string | null;
  listName: string;
  listDescription: string;
  onImported: (result: CommitLookupImportResult) => void;
}) {
  const [step, setStep] = useState<WizardStep>("file");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<WorkbookSheetInfo[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [mapValue, setMapValue] = useState("");
  const [mapLabel, setMapLabel] = useState("");
  const [mapParent, setMapParent] = useState("");
  const [parentMatch, setParentMatch] = useState<ParentMatchMode>("auto");
  const [createMissing, setCreateMissing] = useState(false);
  const [plan, setPlan] = useState<LookupImportPlan | null>(null);
  const [unresolvedExpanded, setUnresolvedExpanded] = useState(false);
  const [result, setResult] = useState<CommitLookupImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("file");
    setFile(null);
    setSheets([]);
    setSheetName("");
    setMapValue("");
    setMapLabel("");
    setMapParent("");
    setParentMatch("auto");
    setCreateMissing(false);
    setPlan(null);
    setUnresolvedExpanded(false);
    setResult(null);
    setBusy(false);
    setError(null);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function applySuggestion(sheet: WorkbookSheetInfo) {
    const suggested = suggestLookupMapping(sheet.headers);
    setMapValue(suggested.value ?? "");
    setMapLabel(suggested.label ?? suggested.value ?? "");
    setMapParent(suggested.parent ?? "");
  }

  async function handleAnalyze(f: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const { sheets: analyzed } = await analyzeLookupWorkbook(fd);
      const nonEmpty = analyzed.filter((s) => s.headers.length > 0);
      if (nonEmpty.length === 0) {
        setError("Το αρχείο δεν περιέχει δεδομένα.");
        return;
      }
      const initial = nonEmpty.reduce((a, b) => (b.rowCount > a.rowCount ? b : a));
      setFile(f);
      setSheets(nonEmpty);
      setSheetName(initial.name);
      applySuggestion(initial);
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία ανάλυσης αρχείου.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSheetChange(nextName: string) {
    setSheetName(nextName);
    const sheet = sheets.find((s) => s.name === nextName);
    if (sheet) applySuggestion(sheet);
  }

  async function runPreview(withCreateMissing: boolean) {
    if (!file || !mapValue) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("sheetName", sheetName);
      fd.set(
        "mapping",
        JSON.stringify({
          value: mapValue,
          label: mapLabel || mapValue,
          ...(mapParent ? { parent: mapParent } : {}),
        })
      );
      fd.set("parentMatch", mapParent ? parentMatch : "auto");
      fd.set("createMissingParents", withCreateMissing ? "1" : "0");
      if (listId) fd.set("listId", listId);
      const nextPlan = await previewLookupImport(fd);
      setPlan(nextPlan);
      setCreateMissing(withCreateMissing);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία προεπισκόπησης.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const committed = await commitLookupImport(
        {
          listId,
          name: listName,
          description: listDescription,
          // Τα ονόματα των στηλών του Excel γίνονται επικεφαλίδες της λίστας.
          valueHeader: mapValue || null,
          labelHeader: mapLabel || mapValue || null,
        },
        plan.items
      );
      setResult(committed);
      setStep("done");
      onImported(committed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία εισαγωγής.");
    } finally {
      setBusy(false);
    }
  }

  const currentSheet = sheets.find((s) => s.name === sheetName);
  const headerOptions = currentSheet?.headers.filter((h) => h.trim() !== "") ?? [];
  const canPreview = mapValue !== "" && (mapLabel !== "" || headerOptions.length === 1);
  const needsListName = !listId && listName.trim() === "";
  const previewTree = plan
    ? treeOrder(plan.items.map((i) => ({ ...i, id: i.value, parentId: i.parentRef })))
    : [];
  const unresolvedShown = plan
    ? unresolvedExpanded
      ? plan.unresolved
      : plan.unresolved.slice(0, 5)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "file" && "Εισαγωγή Excel — Αρχείο"}
            {step === "map" && "Εισαγωγή Excel — Αντιστοίχιση στηλών"}
            {step === "preview" && "Εισαγωγή Excel — Προεπισκόπηση"}
            {step === "done" && "Εισαγωγή Excel — Ολοκληρώθηκε"}
          </DialogTitle>
          <DialogDescription>
            {step === "file" && "Επιλέξτε αρχείο .xlsx με τις τιμές της λίστας."}
            {step === "map" && "Ορίστε ποια στήλη αντιστοιχεί σε κάθε πεδίο."}
            {step === "preview" && "Ελέγξτε το τελικό αποτέλεσμα πριν από την εγγραφή."}
            {step === "done" && "Οι τιμές γράφτηκαν στη λίστα."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {step === "file" && (
          <div className="space-y-3">
            <p className="ui-body-muted">
              Η πρώτη γραμμή του φύλλου θεωρείται επικεφαλίδες. Στο επόμενο βήμα θα
              αντιστοιχίσετε τις στήλες σε Τιμή, Ετικέτα και (προαιρετικά) Γονέα.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAnalyze(f);
              }}
            />
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Επιλογή αρχείου…
            </Button>
          </div>
        )}

        {step === "map" && currentSheet && (
          <div className="space-y-4">
            {sheets.length > 1 && (
              <div className="space-y-1.5">
                <Label className="ui-field-label">Φύλλο εργασίας</Label>
                <Select value={sheetName} onValueChange={handleSheetChange}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name} ({s.rowCount} γραμμές)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  { key: "value", label: "Τιμή (κωδικός)", required: true, val: mapValue, set: setMapValue },
                  { key: "label", label: "Ετικέτα (όνομα)", required: true, val: mapLabel, set: setMapLabel },
                  { key: "parent", label: "Γονέας", required: false, val: mapParent, set: setMapParent },
                ] as const
              ).map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="ui-field-label">
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select
                    value={f.val || NO_COLUMN}
                    onValueChange={(v) => f.set(v === NO_COLUMN ? "" : v)}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="— Καμία —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COLUMN}>— Καμία —</SelectItem>
                      {headerOptions.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {mapParent && (
              <div className="space-y-1.5">
                <Label className="ui-field-label">Αντιστοίχιση γονέα με:</Label>
                <Select
                  value={parentMatch}
                  onValueChange={(v) => setParentMatch(v as ParentMatchMode)}
                >
                  <SelectTrigger className="h-8 w-full text-xs sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PARENT_MATCH_LABEL) as ParentMatchMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {PARENT_MATCH_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentSheet.sampleRows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      {headerOptions.map((h) => (
                        <TableHead key={h} className="ui-eyebrow h-9 whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentSheet.sampleRows.map((row, i) => (
                      <TableRow key={i}>
                        {headerOptions.map((h, j) => {
                          const idx = currentSheet.headers.indexOf(h);
                          return (
                            <TableCell key={j} className="py-1.5 text-xs whitespace-nowrap">
                              {row[idx]?.trim() || "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset} disabled={busy}>
                Πίσω
              </Button>
              <Button
                type="button"
                onClick={() => runPreview(false)}
                disabled={busy || !canPreview}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Προεπισκόπηση
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && plan && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatChip label="Σύνολο γραμμών" count={plan.stats.total} />
              <StatChip label="Νέες" count={plan.stats.created} />
              <StatChip label="Ενημερώσεις" count={plan.stats.updated} />
              <StatChip label="Ρίζες" count={plan.stats.roots} />
              <StatChip label="Επίπεδα βάθους" count={plan.stats.depth} />
            </div>

            {(plan.unresolved.length > 0 || plan.cycles.length > 0) && (
              <div className="space-y-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                {plan.unresolved.length > 0 && (
                  <div className="flex gap-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0 space-y-1">
                      <p className="ui-body font-medium text-amber-800 dark:text-amber-300">
                        Δεν βρέθηκαν {plan.unresolved.length}{" "}
                        {plan.unresolved.length === 1 ? "γονέας" : "γονείς"}:
                      </p>
                      <p className="ui-meta text-amber-700 dark:text-amber-400/80">
                        {unresolvedShown
                          .map((u) => `«${u.name}» (${u.count} ${u.count === 1 ? "γραμμή" : "γραμμές"})`)
                          .join(", ")}
                        {!unresolvedExpanded && plan.unresolved.length > 5 && "…"}
                      </p>
                      {plan.unresolved.length > 5 && (
                        <button
                          type="button"
                          className="ui-meta flex items-center gap-0.5 font-medium text-amber-800 hover:underline dark:text-amber-300"
                          onClick={() => setUnresolvedExpanded((v) => !v)}
                        >
                          {unresolvedExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                          {unresolvedExpanded
                            ? "Λιγότερα"
                            : `Εμφάνιση και των ${plan.unresolved.length - 5} ακόμη`}
                        </button>
                      )}
                      <label className="mt-1.5 flex items-start gap-2">
                        <Checkbox
                          checked={createMissing}
                          disabled={busy}
                          onCheckedChange={(c) => void runPreview(c === true)}
                          className="mt-0.5"
                        />
                        <span className="ui-meta text-amber-800 dark:text-amber-300">
                          Αυτόματη δημιουργία γονέων που λείπουν ως νέες τιμές (ρίζες)
                        </span>
                      </label>
                    </div>
                  </div>
                )}
                {plan.cycles.length > 0 && (
                  <div className="flex gap-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="ui-meta text-amber-700 dark:text-amber-400/80">
                      Κυκλική ιεραρχία σε {plan.cycles.length}{" "}
                      {plan.cycles.length === 1 ? "τιμή" : "τιμές"} (
                      {plan.cycles.slice(0, 5).join(", ")}
                      {plan.cycles.length > 5 ? "…" : ""}) — θα εισαχθούν χωρίς γονέα.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="max-h-72 overflow-y-auto rounded-md border">
              <ul className="divide-y">
                {previewTree.map((node) => (
                  <li
                    key={node.value}
                    className="flex items-center gap-2 px-3 py-1.5"
                    style={{ paddingLeft: `${12 + node.depth * 20}px` }}
                  >
                    <span className="ui-body truncate">{node.label}</span>
                    <span className="ui-meta shrink-0">({node.value})</span>
                    {node.isNew && (
                      <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                        νέο
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {needsListName && (
              <p className="ui-body-muted">
                Συμπληρώστε πρώτα το όνομα της λίστας στη φόρμα για να γίνει η εισαγωγή.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("map")} disabled={busy}>
                Πίσω
              </Button>
              <Button type="button" onClick={handleCommit} disabled={busy || needsListName}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Εισαγωγή
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatChip label="Νέες" count={result.created} />
              <StatChip label="Ενημερώσεις" count={result.updated} />
              <StatChip label="Συνδέσεις γονέα" count={result.linked} />
              <StatChip label="Αποσυνδέσεις" count={result.unlinked} />
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Κλείσιμο
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
