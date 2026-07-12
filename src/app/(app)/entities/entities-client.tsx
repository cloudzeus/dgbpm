"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntityKind } from "@prisma/client";
import {
  FiDownload,
  FiEdit2,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENTITY_KINDS, entityMeta } from "@/lib/entities/registry";
import { treeOrder, withDescendants } from "@/lib/entities/tree";
import {
  createEntity,
  deleteEntity,
  listEntities,
  syncEntities,
  updateEntity,
} from "./actions";

export type EntityRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  softoneKey?: string | null;
  wooId?: string | null;
  categoryId?: string | null;
  colorId?: string | null;
  sizeId?: string | null;
  parentId?: string | null;
  parent?: { name: string } | null;
  category?: { name: string } | null;
  color?: { name: string } | null;
  size?: { name: string } | null;
} & Record<string, unknown>;

type SyncSource = "SOFTONE" | "WOOCOMMERCE";
type SyncSources = { SOFTONE: EntityKind[]; WOOCOMMERCE: EntityKind[] };
type Msg = { type: "ok" | "err"; text: string } | null;
type Option = { id: string; name: string; parentId?: string | null };
type ImportErrors = { rowNumber: number; message: string }[];

const SOURCE_LABEL: Record<SyncSource, string> = {
  SOFTONE: "SoftOne",
  WOOCOMMERCE: "WooCommerce",
};

const RELATION_FIELDS: { key: "categoryId" | "colorId" | "sizeId"; label: string; kind: EntityKind }[] = [
  { key: "categoryId", label: "Κατηγορία", kind: "PRODUCT_CATEGORY" },
  { key: "colorId", label: "Χρώμα", kind: "COLOR" },
  { key: "sizeId", label: "Μέγεθος", kind: "SIZE" },
];

const NONE = "__none__";

function formatCell(value: unknown, kind: "string" | "number" | "boolean"): string {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "boolean") return value ? "Ναι" : "Όχι";
  return String(value);
}

function EntityPanel({
  kind,
  initialRows,
  syncSources,
}: {
  kind: EntityKind;
  initialRows: EntityRow[] | null;
  syncSources: SyncSources;
}) {
  const meta = entityMeta(kind);
  const router = useRouter();
  const [rows, setRows] = useState<EntityRow[] | null>(initialRows);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [importErrors, setImportErrors] = useState<ImportErrors>([]);
  const [isPending, startTransition] = useTransition();
  const [loadedOnce, setLoadedOnce] = useState(initialRows !== null);

  // Dialog CRUD
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formActive, setFormActive] = useState(true);
  const [relations, setRelations] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Option[]> | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<EntityRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import / sync
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState<SyncSource | null>(null);

  const isCategory = kind === "PRODUCT_CATEGORY";
  // Οι εικονικές στήλες (π.χ. «Γονικός Κωδικός») αφορούν μόνο το xlsx.
  const editableColumns = meta.columns.filter((c) => c.key !== "isActive" && !c.virtual);
  const displayColumns = meta.columns.filter((c) => c.key !== "isActive" && !c.virtual);
  const availableSources = (Object.keys(SOURCE_LABEL) as SyncSource[]).filter((s) =>
    syncSources[s].includes(kind)
  );

  function refresh(opts?: { search?: string; includeInactive?: boolean }) {
    const s = opts?.search ?? search;
    const inc = opts?.includeInactive ?? includeInactive;
    startTransition(async () => {
      try {
        const res = await listEntities(kind, { search: s, includeInactive: inc });
        setRows(res.rows as unknown as EntityRow[]);
        setLoadedOnce(true);
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία φόρτωσης." });
      }
    });
  }

  // Το tab γίνεται mount μόνο όταν επιλεγεί — φόρτωσε τότε τα δεδομένα του.
  useEffect(() => {
    if (!loadedOnce) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOptions() {
    if (options) return;
    if (isCategory) {
      try {
        const cats = await listEntities("PRODUCT_CATEGORY", { includeInactive: true });
        setOptions({
          parentId: (cats.rows as unknown as EntityRow[]).map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parentId ?? null,
          })),
        });
      } catch {
        setOptions({ parentId: [] });
      }
      return;
    }
    if (kind !== "PRODUCT") return;
    try {
      const [cats, colors, sizes] = await Promise.all([
        listEntities("PRODUCT_CATEGORY", {}),
        listEntities("COLOR", {}),
        listEntities("SIZE", {}),
      ]);
      setOptions({
        categoryId: (cats.rows as unknown as EntityRow[]).map((r) => ({ id: r.id, name: r.name })),
        colorId: (colors.rows as unknown as EntityRow[]).map((r) => ({ id: r.id, name: r.name })),
        sizeId: (sizes.rows as unknown as EntityRow[]).map((r) => ({ id: r.id, name: r.name })),
      });
    } catch {
      setOptions({ categoryId: [], colorId: [], sizeId: [] });
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({});
    setFormActive(true);
    setRelations({});
    setDialogOpen(true);
    void loadOptions();
  }

  function openEdit(row: EntityRow) {
    setEditingId(row.id);
    const f: Record<string, string> = {};
    for (const c of editableColumns) {
      const v = row[c.key];
      f[c.key] = v === null || v === undefined ? "" : String(v);
    }
    setForm(f);
    setFormActive(row.isActive);
    setRelations({
      categoryId: row.categoryId ?? "",
      colorId: row.colorId ?? "",
      sizeId: row.sizeId ?? "",
      parentId: row.parentId ?? "",
    });
    setDialogOpen(true);
    void loadOptions();
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const data: Record<string, unknown> = { ...form, isActive: formActive };
      if (kind === "PRODUCT") {
        for (const rf of RELATION_FIELDS) data[rf.key] = relations[rf.key] || null;
      }
      if (isCategory) data.parentId = relations.parentId || null;
      const res = editingId
        ? await updateEntity(kind, editingId, data)
        : await createEntity(kind, data);
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
      } else {
        setMsg({
          type: "ok",
          text: editingId ? "Η εγγραφή ενημερώθηκε." : "Η εγγραφή δημιουργήθηκε.",
        });
        setDialogOpen(false);
        refresh();
      }
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await deleteEntity(kind, deleteTarget.id);
      if (!res.ok) setMsg({ type: "err", text: res.error });
      else {
        setMsg({ type: "ok", text: "Η εγγραφή διαγράφηκε." });
        refresh();
      }
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία διαγραφής." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function toggleActive(row: EntityRow) {
    setMsg(null);
    const data: Record<string, unknown> = {};
    for (const c of editableColumns) data[c.key] = row[c.key];
    data.isActive = !row.isActive;
    if (kind === "PRODUCT") {
      data.categoryId = row.categoryId ?? null;
      data.colorId = row.colorId ?? null;
      data.sizeId = row.sizeId ?? null;
    }
    try {
      const res = await updateEntity(kind, row.id, data);
      if (!res.ok) setMsg({ type: "err", text: res.error });
      else refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία ενημέρωσης." });
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setMsg(null);
    setImportErrors([]);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch("/api/entities/xlsx", { method: "POST", body: fd });
      const json = (await res.json()) as {
        created?: number;
        updated?: number;
        errors?: ImportErrors;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ type: "err", text: json.error ?? "Αποτυχία εισαγωγής." });
      } else {
        const errs = json.errors ?? [];
        setImportErrors(errs);
        setMsg({
          type: errs.length > 0 ? "err" : "ok",
          text: `Εισαγωγή: ${json.created ?? 0} νέες, ${json.updated ?? 0} ενημερώσεις${
            errs.length > 0 ? `, ${errs.length} σφάλματα` : ""
          }.`,
        });
        refresh();
        router.refresh();
      }
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία εισαγωγής." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSync(source: SyncSource) {
    setSyncing(source);
    setMsg(null);
    try {
      const res = await syncEntities(kind, source);
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
      } else {
        setMsg({
          type: "ok",
          text: `Συγχρονισμός ${SOURCE_LABEL[source]}: ${res.created} νέες, ${res.updated} ενημερώσεις, ${res.skipped} παραλείφθηκαν.`,
        });
        refresh();
        router.refresh();
      }
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία συγχρονισμού." });
    } finally {
      setSyncing(null);
    }
  }

  // Κατηγορίες: depth-first σειρά δέντρου με βάθος για indented εμφάνιση.
  const displayRows: (EntityRow & { depth: number })[] = isCategory
    ? treeOrder((rows ?? []).map((r) => ({ ...r, parentId: r.parentId ?? null })))
    : (rows ?? []).map((r) => ({ ...r, depth: 0 }));

  // Επιλογές γονέα στο dialog: δέντρο, χωρίς τον εαυτό και τους απογόνους του.
  const parentOptions = (() => {
    if (!isCategory) return [];
    const all = (options?.parentId ?? []).map((o) => ({ ...o, parentId: o.parentId ?? null }));
    const excluded = editingId ? withDescendants(all, editingId) : new Set<string>();
    return treeOrder(all).filter((o) => !excluded.has(o.id));
  })();

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          <div>{msg.text}</div>
          {importErrors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 space-y-0.5">
              {importErrors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  {e.rowNumber > 0 ? `Γραμμή ${e.rowNumber}: ` : ""}
                  {e.message}
                </li>
              ))}
              {importErrors.length > 20 && (
                <li>… και {importErrors.length - 20} ακόμη σφάλματα.</li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <FiSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-56 pl-8"
            placeholder="Αναζήτηση (κωδικός/όνομα)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              refresh({ search: e.target.value });
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="size-4 accent-[#0c0ce5]"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              refresh({ includeInactive: e.target.checked });
            }}
          />
          Εμφάνιση ανενεργών
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {availableSources.map((source) => (
            <Button
              key={source}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSync(source)}
              disabled={syncing !== null || importing}
            >
              {syncing === source ? (
                <FiLoader className="size-4 animate-spin" />
              ) : (
                <FiRefreshCw className="size-4" />
              )}
              Συγχρονισμός {SOURCE_LABEL[source]}
            </Button>
          ))}
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href={`/api/entities/xlsx?kind=${kind}`}>
              <FiDownload className="size-4" />
              Πρότυπο xlsx
            </a>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing || syncing !== null}
          >
            {importing ? <FiLoader className="size-4 animate-spin" /> : <FiUpload className="size-4" />}
            Εισαγωγή xlsx
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <FiPlus className="size-4" />
            Νέα εγγραφή
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((c) => (
                <TableHead key={c.key}>{c.headerGr}</TableHead>
              ))}
              {kind === "PRODUCT" && (
                <>
                  <TableHead>Κατηγορία</TableHead>
                  <TableHead>Χρώμα</TableHead>
                  <TableHead>Μέγεθος</TableHead>
                </>
              )}
              <TableHead>Κατάσταση</TableHead>
              <TableHead>Πηγή</TableHead>
              <TableHead className="text-right">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={displayColumns.length + (kind === "PRODUCT" ? 6 : 3)}
                  className="text-center text-muted-foreground py-8"
                >
                  {isPending || rows === null ? "Φόρτωση…" : "Δεν βρέθηκαν εγγραφές."}
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row) => (
                <TableRow key={row.id} className={row.isActive ? "" : "opacity-60"}>
                  {displayColumns.map((c) => (
                    <TableCell key={c.key} className={c.key === "code" ? "font-medium" : ""}>
                      {isCategory && c.key === "name" && row.depth > 0 ? (
                        <span style={{ paddingLeft: `${row.depth * 16}px` }} className="text-muted-foreground">
                          {"— "}
                          <span className="text-foreground">{formatCell(row[c.key], c.kind)}</span>
                        </span>
                      ) : (
                        formatCell(row[c.key], c.kind)
                      )}
                    </TableCell>
                  ))}
                  {kind === "PRODUCT" && (
                    <>
                      <TableCell>{row.category?.name ?? "—"}</TableCell>
                      <TableCell>{row.color?.name ?? "—"}</TableCell>
                      <TableCell>{row.size?.name ?? "—"}</TableCell>
                    </>
                  )}
                  <TableCell>
                    {row.isActive ? (
                      <Badge variant="secondary">Ενεργό</Badge>
                    ) : (
                      <Badge variant="outline">Ανενεργό</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {row.softoneKey && (
                        <Badge variant="outline" className="text-[10px]">
                          SoftOne
                        </Badge>
                      )}
                      {row.wooId && (
                        <Badge variant="outline" className="text-[10px]">
                          Woo
                        </Badge>
                      )}
                      {!row.softoneKey && !row.wooId && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title={row.isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        onClick={() => toggleActive(row)}
                      >
                        {row.isActive ? "Απενεργ." : "Ενεργ."}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Επεξεργασία"
                        onClick={() => openEdit(row)}
                      >
                        <FiEdit2 className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Διαγραφή"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <FiTrash2 className="size-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog δημιουργίας/επεξεργασίας */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? `Επεξεργασία — ${meta.labelSingularGr}`
                : `Νέα εγγραφή — ${meta.labelSingularGr}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {editableColumns.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <Label htmlFor={`${kind}-${c.key}`}>
                  {c.headerGr}
                  {c.required && <span className="text-red-600"> *</span>}
                </Label>
                <Input
                  id={`${kind}-${c.key}`}
                  type={c.kind === "number" ? "text" : "text"}
                  inputMode={c.kind === "number" ? "decimal" : undefined}
                  value={form[c.key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                />
              </div>
            ))}
            {kind === "PRODUCT" &&
              RELATION_FIELDS.map((rf) => (
                <div key={rf.key} className="space-y-1.5">
                  <Label>{rf.label}</Label>
                  <Select
                    value={relations[rf.key] || NONE}
                    onValueChange={(v) =>
                      setRelations((r) => ({ ...r, [rf.key]: v === NONE ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Καμία επιλογή —</SelectItem>
                      {(options?.[rf.key] ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            {isCategory && (
              <div className="space-y-1.5">
                <Label>Γονική κατηγορία</Label>
                <Select
                  value={relations.parentId || NONE}
                  onValueChange={(v) =>
                    setRelations((r) => ({ ...r, parentId: v === NONE ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Καμία (ρίζα) —</SelectItem>
                    {parentOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {`${"  ".repeat(o.depth)}${o.depth > 0 ? "— " : ""}${o.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id={`${kind}-active`}
                type="checkbox"
                className="size-4 accent-[#0c0ce5]"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
              />
              <Label htmlFor={`${kind}-active`} className="cursor-pointer">
                Ενεργή εγγραφή
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Ακύρωση
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <FiLoader className="size-4 animate-spin" />}
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Επιβεβαίωση διαγραφής */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή εγγραφής;</AlertDialogTitle>
            <AlertDialogDescription>
              Θα διαγραφεί οριστικά η εγγραφή «{deleteTarget?.code} — {deleteTarget?.name}». Αν
              χρησιμοποιείται σε διαδικασίες, προτιμήστε απενεργοποίηση.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Διαγραφή…" : "Διαγραφή"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EntitiesClient({
  initialKind,
  initialRows,
  syncSources,
}: {
  initialKind: EntityKind;
  initialRows: EntityRow[];
  syncSources: SyncSources;
}) {
  return (
    <Tabs defaultValue={initialKind}>
      <TabsList className="flex-wrap">
        {ENTITY_KINDS.map((kind) => (
          <TabsTrigger key={kind} value={kind}>
            {entityMeta(kind).labelGr}
          </TabsTrigger>
        ))}
      </TabsList>
      {ENTITY_KINDS.map((kind) => (
        <TabsContent key={kind} value={kind} className="mt-6">
          <EntityPanel
            kind={kind}
            initialRows={kind === initialKind ? initialRows : null}
            syncSources={syncSources}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
