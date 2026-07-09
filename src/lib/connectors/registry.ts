import type { ConnectorType } from "@prisma/client";

/** Ένα πεδίο διαμόρφωσης ενός connector. */
export interface ConnectorField {
  key: string;
  label: string;
  /** Αν true, το πεδίο κρυπτογραφείται και ΔΕΝ επιστρέφεται ποτέ σε plaintext στο client. */
  secret?: boolean;
  placeholder?: string;
  optional?: boolean;
  help?: string;
}

export interface ConnectorDef {
  type: ConnectorType;
  label: string;
  /** Σύντομη περιγραφή του τι κάνει η διασύνδεση. */
  description: string;
  /** Κατηγορία: eshop ή erp. */
  kind: "eshop" | "erp";
  fields: ConnectorField[];
}

export const CONNECTOR_DEFS: ConnectorDef[] = [
  {
    type: "SOFTONE",
    label: "SoftOne (ERP)",
    description: "Διασύνδεση με SoftOne ERP μέσω των επίσημων Web Services.",
    kind: "erp",
    fields: [
      { key: "serial", label: "Serial No", placeholder: "π.χ. 000000000000", help: "Το serial του installation (https://{serial}.oncloud.gr)." },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
      { key: "appId", label: "App ID", secret: true },
      { key: "company", label: "Company", placeholder: "π.χ. 1001" },
      { key: "branch", label: "Branch", placeholder: "π.χ. 1000", optional: true },
      { key: "module", label: "Module", optional: true },
      { key: "refid", label: "Ref ID", optional: true },
    ],
  },
  {
    type: "WOOCOMMERCE",
    label: "WooCommerce",
    description: "Διασύνδεση με eshop WooCommerce μέσω του WooCommerce REST API.",
    kind: "eshop",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://shop.example.com", help: "Χωρίς / στο τέλος και χωρίς /wp-json." },
      { key: "consumerKey", label: "Consumer Key", secret: true, placeholder: "ck_..." },
      { key: "consumerSecret", label: "Consumer Secret", secret: true, placeholder: "cs_..." },
    ],
  },
  {
    type: "MAGENTO",
    label: "Magento",
    description: "Διασύνδεση με eshop Magento 2 μέσω του Magento REST API.",
    kind: "eshop",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://shop.example.com", help: "Το root του καταστήματος (χωρίς /rest)." },
      { key: "accessToken", label: "Access Token", secret: true, help: "Integration / Bearer token." },
    ],
  },
  {
    type: "OPENCARD",
    label: "Open Card",
    description: "Διασύνδεση με το σύστημα καρτών/eshop Open Card.",
    kind: "eshop",
    fields: [
      { key: "baseUrl", label: "Base URL / Endpoint", placeholder: "https://api.opencard.example" },
      { key: "apiKey", label: "API Key", secret: true },
      { key: "username", label: "Username", optional: true },
      { key: "password", label: "Password", secret: true, optional: true },
    ],
  },
];

export function getConnectorDef(type: ConnectorType): ConnectorDef {
  const def = CONNECTOR_DEFS.find((d) => d.type === type);
  if (!def) throw new Error(`Άγνωστος τύπος connector: ${type}`);
  return def;
}

/** Χωρίζει τιμές πεδίων σε μη-ευαίσθητα (config) και ευαίσθητα (secrets). */
export function splitFieldValues(
  type: ConnectorType,
  values: Record<string, string>,
): { config: Record<string, string>; secrets: Record<string, string> } {
  const def = getConnectorDef(type);
  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const f of def.fields) {
    const v = (values[f.key] ?? "").trim();
    if (v === "") continue;
    if (f.secret) secrets[f.key] = v;
    else config[f.key] = v;
  }
  return { config, secrets };
}
