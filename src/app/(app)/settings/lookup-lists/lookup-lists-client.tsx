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
} from "lucide-react";

type LookupItem = { id: string; value: string; label: string; order: number; parentId: string | null };

type LookupList = {
  id: string;
  name: string;
  description: string | null;
  items: LookupItem[];
  _count: { fields: number };
};

type ItemInput = { rowId: string; value: string; label: string; parentValue: string };

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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemInput[]>([]);

  function resetForm() {
    setName("");
    setDescription("");
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
    const valueById = new Map(list.items.map((it) => [it.id, it.value]));
    setItems(
      list.items.map((it) => ({
        rowId: crypto.randomUUID(),
        value: it.value,
        label: it.label,
        parentValue: (it.parentId && valueById.get(it.parentId)) || "",
      }))
    );
    setFormError(null);
    setOpen(true);
  }

  function addItem() {
    setItems((prev) => [...prev, { rowId: crypto.randomUUID(), value: "", label: "", parentValue: "" }]);
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
        }))
        .filter((it) => it.value !== "");
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
              <div className="overflow-hidden rounded-md border">
                {items.length === 0 ? (
                  <p className="ui-body-muted p-4">
                    Καμία τιμή ακόμη. Προσθέστε μία ή κάντε εισαγωγή από αρχείο Excel (στήλες value/label και προαιρετικά «Γονικός Κωδικός»).
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead className="ui-eyebrow h-9">Τιμή (value)</TableHead>
                        <TableHead className="ui-eyebrow h-9">Ετικέτα (label)</TableHead>
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
        { listId, name: listName, description: listDescription },
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
