"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import { buildPivotRows, type PivotField, type PivotInstance } from "@/lib/process-fields/pivot";
import {
  exportResultsExcel,
  exportResultsPdf,
  exportResultsWord,
  type ResultsExport,
} from "@/lib/process-results/results-export";

type Format = "excel" | "pdf" | "word";

export function ResultsClient(props: {
  title: string;
  fields: PivotField[];
  instances: PivotInstance[];
}) {
  const { title, fields, instances } = props;
  const rows = useMemo(() => buildPivotRows(fields, instances), [fields, instances]);
  const [selected, setSelected] = useState<Record<Format, boolean>>({
    excel: true,
    pdf: false,
    word: false,
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(fmt: Format) {
    setSelected((s) => ({ ...s, [fmt]: !s[fmt] }));
  }

  async function handleExport() {
    setError(null);
    const formats = (Object.keys(selected) as Format[]).filter((f) => selected[f]);
    if (formats.length === 0) {
      setError("Επιλέξτε τουλάχιστον μία μορφή εξαγωγής.");
      return;
    }
    const data: ResultsExport = {
      title,
      columns: ["Διαδικασία", ...fields.map((f) => f.name)],
      rows: rows.map((r) => [r.instanceName, ...fields.map((f) => r.cells[f.id] ?? "")]),
    };
    setExporting(true);
    try {
      for (const fmt of formats) {
        if (fmt === "excel") await exportResultsExcel(data);
        else if (fmt === "word") await exportResultsWord(data);
        else if (fmt === "pdf") {
          const { robotoRegularBase64 } = await import("@/app/(app)/organization/roboto-font");
          await exportResultsPdf(data, robotoRegularBase64);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Σφάλμα κατά την εξαγωγή.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{rows.length} διαδικασίες</span>
          {error && <span className="text-destructive text-sm">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Εξαγωγή <ChevronDown className="ml-1 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Μορφές</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={selected.excel}
                onCheckedChange={() => toggle("excel")}
                onSelect={(e) => e.preventDefault()}
              >
                Excel
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={selected.pdf}
                onCheckedChange={() => toggle("pdf")}
                onSelect={(e) => e.preventDefault()}
              >
                PDF
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={selected.word}
                onCheckedChange={() => toggle("word")}
                onSelect={(e) => e.preventDefault()}
              >
                Word
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting && <Loader2 className="mr-1 size-4 animate-spin" />}
            Εξαγωγή
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Διαδικασία</TableHead>
              {fields.map((f) => (
                <TableHead key={f.id}>{f.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={fields.length + 1} className="text-muted-foreground text-center">
                  Δεν υπάρχουν καταχωρημένες διαδικασίες.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.instanceId}>
                  <TableCell className="font-medium">{r.instanceName}</TableCell>
                  {fields.map((f) => (
                    <TableCell key={f.id}>{r.cells[f.id] ?? ""}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
