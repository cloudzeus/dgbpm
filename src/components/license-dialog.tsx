"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface LicenseData {
  serialNumber: string;
  licenseDate: string;
  licenseCompany: string;
  licenseCustomer: string;
}

interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LicenseDialog({ open, onOpenChange }: LicenseDialogProps) {
  const [data, setData] = useState<LicenseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/license")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load license");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Could not load license information."))
      .finally(() => setLoading(false));
  }, [open]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>License Agreement</DialogTitle>
          <DialogDescription>
            Software license and activation details for this installation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {loading && (
            <div className="text-muted-foreground text-sm">Loading…</div>
          )}
          {error && (
            <div className="text-destructive text-sm">{error}</div>
          )}
          {!loading && !error && data && (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">
                  Serial number
                </dt>
                <dd className="mt-0.5 font-mono">{data.serialNumber || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Activation date
                </dt>
                <dd className="mt-0.5">
                  {formatDate(data.licenseDate)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Licensor (seller)
                </dt>
                <dd className="mt-0.5">{data.licenseCompany || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  Licensee (customer)
                </dt>
                <dd className="mt-0.5">{data.licenseCustomer || "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
