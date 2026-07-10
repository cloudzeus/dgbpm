"use client";

import { useState, useTransition } from "react";
import { FiSave, FiLoader, FiZap, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONNECTOR_DEFS, type ConnectorDef } from "@/lib/connectors/registry";
import { saveConnector, testConnector, type ConnectorView } from "./actions";

type Msg = { type: "ok" | "err"; text: string } | null;

function ConnectorPanel({ def, initial }: { def: ConnectorDef; initial: ConnectorView }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [values, setValues] = useState<Record<string, string>>({ ...initial.config });
  const [secretsSet, setSecretsSet] = useState<Record<string, boolean>>(initial.secretsSet);
  const [msg, setMsg] = useState<Msg>(null);
  const [isSaving, startSaving] = useTransition();
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<{ ok: boolean; text: string } | null>(
    initial.lastTestOk === null
      ? null
      : { ok: initial.lastTestOk, text: initial.lastTestMsg ?? "" },
  );

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSave() {
    setMsg(null);
    startSaving(async () => {
      try {
        await saveConnector(def.type, enabled, values);
        // Τα secrets που συμπληρώθηκαν θεωρούνται πλέον αποθηκευμένα· καθαρίζουμε τα πεδία.
        const cleared: Record<string, string> = { ...values };
        const newSet = { ...secretsSet };
        for (const f of def.fields) {
          if (f.secret && (values[f.key] ?? "").trim() !== "") {
            newSet[f.key] = true;
            cleared[f.key] = "";
          }
        }
        setSecretsSet(newSet);
        setValues(cleared);
        setMsg({ type: "ok", text: "Τα στοιχεία αποθηκεύτηκαν." });
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης." });
      }
    });
  }

  async function handleTest() {
    setMsg(null);
    setTesting(true);
    try {
      const res = await testConnector(def.type, values);
      setLastTest({ ok: res.ok, text: res.message });
    } catch (e) {
      setLastTest({ ok: false, text: e instanceof Error ? e.message : "Αποτυχία δοκιμής." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          {msg.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {def.label}
            <Badge variant={def.kind === "erp" ? "default" : "secondary"}>
              {def.kind === "erp" ? "ERP" : def.kind === "email" ? "Email" : "eshop"}
            </Badge>
            {enabled && <Badge variant="secondary">Ενεργός</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{def.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              id={`enabled-${def.type}`}
              type="checkbox"
              className="size-4 accent-[#0c0ce5]"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <Label htmlFor={`enabled-${def.type}`} className="cursor-pointer">
              Ενεργοποίηση διασύνδεσης
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((f) => {
              const isSetSecret = f.secret && secretsSet[f.key];
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`${def.type}-${f.key}`}>
                    {f.label}
                    {f.optional && (
                      <span className="ml-1 text-xs text-muted-foreground">(προαιρετικό)</span>
                    )}
                  </Label>
                  <Input
                    id={`${def.type}-${f.key}`}
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    placeholder={
                      isSetSecret ? "•••••••• (αποθηκευμένο — αφήστε κενό για να μη μεταβληθεί)" : f.placeholder
                    }
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              );
            })}
          </div>

          {lastTest && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                lastTest.ok
                  ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
                  : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {lastTest.ok ? (
                <FiCheckCircle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <FiXCircle className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{lastTest.text}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleTest} disabled={testing || isSaving}>
              {testing ? <FiLoader className="size-4 animate-spin" /> : <FiZap className="size-4" />}
              Δοκιμή σύνδεσης
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving || testing}>
              {isSaving ? <FiLoader className="size-4 animate-spin" /> : <FiSave className="size-4" />}
              Αποθήκευση
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConnectorsClient({ connectors }: { connectors: ConnectorView[] }) {
  const byType = new Map(connectors.map((c) => [c.type, c]));

  return (
    <Tabs defaultValue={CONNECTOR_DEFS[0].type}>
      <TabsList>
        {CONNECTOR_DEFS.map((def) => (
          <TabsTrigger key={def.type} value={def.type}>
            {def.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {CONNECTOR_DEFS.map((def) => {
        const initial =
          byType.get(def.type) ??
          ({
            type: def.type,
            enabled: false,
            config: {},
            secretsSet: {},
            lastTestAt: null,
            lastTestOk: null,
            lastTestMsg: null,
          } as ConnectorView);
        return (
          <TabsContent key={def.type} value={def.type} className="mt-6">
            <ConnectorPanel def={def} initial={initial} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
