"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fieldTypeLabel } from "@/lib/process-fields/field-types";
import {
  generateBusinessProcesses,
  createProcessTemplatesFromBlueprints,
  type ProcessBlueprint,
} from "../../process-templates/actions";

export function ProcessAdvisorClient() {
  const [description, setDescription] = useState("");
  const [processes, setProcesses] = useState<ProcessBlueprint[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setCreatedCount(null);
    setProcesses([]);
    setSelected(new Set());
    const res = await generateBusinessProcesses({ description });
    setGenerating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProcesses(res.processes);
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(processes.map((_, i) => i)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function handleCreate() {
    const chosen = processes.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createProcessTemplatesFromBlueprints(chosen);
      setCreatedCount(res.created);
      setProcesses([]);
      setSelected(new Set());
      setDescription("");
    } catch {
      setError("Αποτυχία δημιουργίας των προτύπων. Δοκιμάστε ξανά.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Περιγράψτε την επιχείρησή σας… (π.χ. αντικείμενο, τμήματα, τι σας απασχολεί οργανωτικά)"
            rows={5}
            disabled={generating}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={generating || !description.trim()}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Πρόταση διαδικασιών (AI)
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {createdCount !== null && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>
                Δημιουργήθηκαν {createdCount} πρότυπα διαδικασιών.
              </span>
            </div>
            <Button asChild variant="outline">
              <Link href="/process-templates">Δείτε τα πρότυπα</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {processes.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Προτεινόμενες διαδικασίες: {processes.length}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Επιλογή όλων
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Καθαρισμός
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {processes.map((p, i) => (
              <Card
                key={i}
                className={
                  selected.has(i)
                    ? "border-primary/50 ring-1 ring-primary/30 transition-shadow"
                    : "transition-shadow"
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={() => toggle(i)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.name || "Διαδικασία"}</span>
                        <Badge variant="secondary">{p.tasks.length} βήματα</Badge>
                        <Badge variant="secondary">{p.fields.length} πεδία</Badge>
                      </div>
                      {p.description && (
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="details" className="border-none">
                      <AccordionTrigger className="py-2 text-sm">
                        Λεπτομέρειες βημάτων & πεδίων
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                              Βήματα
                            </p>
                            <ol className="list-decimal space-y-1 pl-5 text-sm">
                              {p.tasks.map((t, ti) => (
                                <li key={ti}>
                                  <span className="font-medium">{t.name}</span>
                                  {t.mandatory && (
                                    <span className="text-muted-foreground"> — υποχρεωτικό</span>
                                  )}
                                  {t.needFile && (
                                    <span className="text-muted-foreground"> — απαιτεί αρχείο</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                          {p.fields.length > 0 && (
                            <div>
                              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                Πεδία
                              </p>
                              <ul className="space-y-1 text-sm">
                                {p.fields.map((f, fi) => (
                                  <li key={fi}>
                                    <span className="font-medium">{f.name}</span>
                                    <span className="text-muted-foreground">
                                      {" — "}
                                      {fieldTypeLabel(f.type)}
                                      {" — «βήμα "}
                                      {(f.captureTaskOrder ?? 0) + 1}»
                                      {f.required ? " — υποχρ." : ""}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-4 flex justify-end">
            <Button onClick={handleCreate} disabled={creating || selected.size === 0} size="lg">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Δημιουργία επιλεγμένων ({selected.size})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
