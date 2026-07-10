"use client";

import * as React from "react";
import { MoreVertical, Search, Columns3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataTableColumn<T> = {
  /** Stable key — also used to persist width/visibility. */
  key: string;
  /** Header label. */
  header: React.ReactNode;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** Fixed starting width in px. Enables the resize handle when `resizable`. */
  width?: number;
  /** Minimum width when resizing (default 56). */
  minWidth?: number;
  align?: "left" | "right" | "center";
  /** Whether the user can hide this column from the column menu (default true). */
  hideable?: boolean;
  /** Hidden by default (still toggleable). */
  defaultHidden?: boolean;
  className?: string;
  headerClassName?: string;
};

export type DataTableAction<T> = {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect: (row: T) => void;
  destructive?: boolean;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
  /** Hide this action for a specific row. */
  hidden?: (row: T) => boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;

  /** Right-aligned per-row actions menu (⋮). */
  actions?: (row: T) => DataTableAction<T>[];
  /** Header label for the actions column (sr-only). */
  actionsLabel?: string;

  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;

  /** Expandable rows. When provided, a chevron is shown on the left. */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Controlled expansion (optional). */
  expandedKeys?: Set<string>;
  onToggleExpand?: (row: T) => void;

  // -- toolbar --
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Text used for client-side filtering when `searchable`. */
  getSearchText?: (row: T) => string;
  /** Extra toolbar content, rendered on the right (e.g. "New" button). */
  toolbar?: React.ReactNode;
  /** Show the column visibility menu. */
  columnToggle?: boolean;
  columnToggleLabel?: string;

  /** Enable column resizing (requires column `width`). */
  resizable?: boolean;
  /** Persist widths + visibility to localStorage under this key. */
  storageKey?: string;

  emptyMessage?: React.ReactNode;
  /** Fill the parent's height with an internal scroll area + sticky header. */
  fullHeight?: boolean;
  /** Caption / footer rendered below the table. Receives filtered rows. */
  footer?: (rows: T[]) => React.ReactNode;
  className?: string;
  /** Density. */
  size?: "sm" | "md";
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  columns,
  data,
  rowKey,
  actions,
  actionsLabel = "Ενέργειες",
  onRowClick,
  rowClassName,
  renderExpanded,
  expandedKeys,
  onToggleExpand,
  searchable,
  searchPlaceholder = "Αναζήτηση…",
  getSearchText,
  toolbar,
  columnToggle,
  columnToggleLabel = "Στήλες",
  resizable,
  storageKey,
  emptyMessage = "Δεν βρέθηκαν εγγραφές.",
  fullHeight,
  footer,
  className,
  size = "sm",
}: DataTableProps<T>) {
  const ACTIONS_COL_W = 56;

  // -- visibility --
  const [visible, setVisible] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, !c.defaultHidden])),
  );
  // -- widths --
  const [widths, setWidths] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, c.width ?? 160])),
  );

  // -- load persisted prefs --
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const p = JSON.parse(raw) as {
        visible?: Record<string, boolean>;
        widths?: Record<string, number>;
      };
      if (p.visible) setVisible((v) => ({ ...v, ...p.visible }));
      if (p.widths) setWidths((w) => ({ ...w, ...p.widths }));
    } catch {}
  }, [storageKey]);

  const persist = React.useCallback(
    (v: Record<string, boolean>, w: Record<string, number>) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ visible: v, widths: w }));
      } catch {}
    },
    [storageKey],
  );

  // -- resize -- move/end handlers are scoped inside the start callback so the
  // pair can reference each other (and remove themselves) without a cycle.
  const onResizeStart = React.useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();
      const col = columns.find((c) => c.key === key);
      const min = col?.minWidth ?? 56;
      const startX = e.clientX;
      const startW = widths[key];
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(min, startW + (ev.clientX - startX));
        setWidths((prev) => ({ ...prev, [key]: next }));
      };
      const onEnd = () => {
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        setWidths((w) => {
          setVisible((v) => {
            persist(v, w);
            return v;
          });
          return w;
        });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
    },
    [columns, widths, persist],
  );

  function toggleCol(key: string) {
    setVisible((v) => {
      const next = { ...v, [key]: !v[key] };
      persist(next, widths);
      return next;
    });
  }

  // -- search --
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    if (!searchable || !getSearchText) return data;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => getSearchText(row).toLowerCase().includes(q));
  }, [data, query, searchable, getSearchText]);

  const shownCols = columns.filter((c) => visible[c.key]);
  const useFixed = resizable;
  const totalWidth =
    (actions ? ACTIONS_COL_W : 0) +
    shownCols.reduce((s, c) => s + (widths[c.key] ?? c.width ?? 160), 0);

  const showChevron = !!renderExpanded;
  const cellPad = size === "sm" ? "px-3 py-1.5" : "px-3 py-2.5";
  const headPad = size === "sm" ? "px-3 py-2" : "px-3 py-2.5";

  const hasToolbar = searchable || columnToggle || toolbar;

  return (
    <div className={cn(fullHeight && "flex h-full min-h-0 flex-col", className)}>
      {/* -------- Toolbar -------- */}
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {columnToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Columns3 className="size-3.5" />
                    {columnToggleLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-xs">Ορατές στήλες</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columns.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={visible[c.key]}
                      disabled={c.hideable === false}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => c.hideable !== false && toggleCol(c.key)}
                      className="text-xs"
                    >
                      {c.header}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {toolbar}
          </div>
        </div>
      )}

      {/* -------- Table -------- */}
      <div
        className={cn(
          "overflow-auto rounded-lg border bg-card shadow-sm",
          fullHeight && "min-h-0 flex-1",
        )}
      >
        <table
          className={cn("w-full border-collapse text-xs", useFixed && "table-fixed")}
          style={useFixed ? { minWidth: totalWidth } : undefined}
        >
          {useFixed && (
            <colgroup>
              {showChevron && <col style={{ width: 36 }} />}
              {shownCols.map((c) => (
                <col key={c.key} style={{ width: widths[c.key] }} />
              ))}
              {actions && <col style={{ width: ACTIONS_COL_W }} />}
            </colgroup>
          )}
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/60 backdrop-blur">
              {showChevron && <th className="w-9" />}
              {shownCols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "group relative select-none text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    headPad,
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    (!c.align || c.align === "left") && "text-left",
                    c.headerClassName,
                  )}
                >
                  <span className="truncate">{c.header}</span>
                  {resizable && c.width != null && (
                    <span
                      onMouseDown={(e) => onResizeStart(e, c.key)}
                      className="absolute -right-px top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center"
                    >
                      <span className="h-4 w-px bg-border transition-colors group-hover:bg-primary/50" />
                    </span>
                  )}
                </th>
              ))}
              {actions && (
                <th className={cn(headPad, "text-right")}>
                  <span className="sr-only">{actionsLabel}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={shownCols.length + (showChevron ? 1 : 0) + (actions ? 1 : 0)}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {filtered.map((row) => {
              const key = rowKey(row);
              const isOpen = expandedKeys?.has(key) ?? false;
              const rowActions = actions?.(row).filter((a) => !a.hidden?.(row)) ?? [];
              const clickable = !!onRowClick || (!!renderExpanded && !!onToggleExpand);
              return (
                <React.Fragment key={key}>
                  <tr
                    onClick={
                      clickable
                        ? () => {
                            if (onRowClick) onRowClick(row);
                            else onToggleExpand?.(row);
                          }
                        : undefined
                    }
                    className={cn(
                      "border-b transition-colors hover:bg-muted/40",
                      clickable && "cursor-pointer",
                      isOpen && "bg-muted/50",
                      rowClassName?.(row),
                    )}
                  >
                    {showChevron && (
                      <td className="pl-2 align-middle">
                        <ChevronRight
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-90 text-foreground",
                          )}
                        />
                      </td>
                    )}
                    {shownCols.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "overflow-hidden align-middle",
                          cellPad,
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.className,
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center truncate",
                            c.align === "right" && "justify-end",
                            c.align === "center" && "justify-center",
                          )}
                        >
                          {c.cell(row)}
                        </div>
                      </td>
                    ))}
                    {actions && (
                      <td className={cn(cellPad, "text-right align-middle")}>
                        {rowActions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                                title={actionsLabel}
                              >
                                <MoreVertical className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {rowActions.map((a, i) => (
                                <React.Fragment key={i}>
                                  {a.separatorBefore && <DropdownMenuSeparator />}
                                  <DropdownMenuItem
                                    className={cn(
                                      "gap-2 text-xs",
                                      a.destructive && "text-destructive focus:text-destructive",
                                    )}
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      a.onSelect(row);
                                    }}
                                  >
                                    {a.icon}
                                    {a.label}
                                  </DropdownMenuItem>
                                </React.Fragment>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    )}
                  </tr>
                  {isOpen && renderExpanded && (
                    <tr className="border-b bg-muted/20">
                      <td
                        colSpan={shownCols.length + (showChevron ? 1 : 0) + (actions ? 1 : 0)}
                        className="p-0"
                      >
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer && <div className="pt-2 text-[11px] text-muted-foreground">{footer(filtered)}</div>}
    </div>
  );
}
