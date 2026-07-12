# Οντότητες (Entities) — SoftOne-aligned λίστες με sync & xlsx (Design)

**Date:** 2026-07-12
**Status:** Approved by user

## Purpose

Typed entity lists — suppliers, customers, products, product categories,
colors, sizes — that (a) follow the SoftOne data structure, (b) can be
referenced from process-template custom fields, (c) import from configured
ecommerce/ERP connectors (pull-only), and (d) import via xlsx upload.
Everywhere: **code + name** (κωδικός + όνομα).

## Data model (separate Prisma models)

Common to all six models: `id` cuid, `code` (unique), `name`, `isActive
Boolean @default(true)`, external refs `softoneKey String?`, `wooId String?`,
`magentoId String?`, `opencardId String?`, timestamps.

Per SoftOne alignment:

| Model | Extra fields (SoftOne source) |
|---|---|
| `Supplier`, `Customer` (TRDR) | code VarChar(25), name VarChar(128), `afm` VarChar(20)?, `address` (100)?, `city` (30)?, `zip` (10)?, `phone` (20)?, `email` (128)? |
| `Product` (MTRL/ITEM) | code VarChar(50), name VarChar(128), `categoryId` → ProductCategory?, `priceWholesale Float?` (PRICEW), `priceRetail Float?` (PRICER), `vatPct Float?`, `unit String?`, `colorId?` → Color, `sizeId?` → Size |
| `ProductCategory` (ITECATEGORY) | code, name |
| `Color`, `Size` (generic EditList pattern) | code, name |

`EntityKind` enum: `SUPPLIER | CUSTOMER | PRODUCT | PRODUCT_CATEGORY | COLOR
| SIZE`. Schema applied with `prisma db push`.

## Process-template referencing

- `FieldType` gains `ENTITY`. `ProcessFieldDefinition` gains
  `entityKind EntityKind?` (required when type is ENTITY).
- `ProcessFieldValue` gains `valueEntityId String?` (no DB-level FK —
  polymorphic across the six tables; resolution at read time).
- Template editor (wizard step-fields) offers type «Οντότητα» + kind picker.
- Instance runtime (dynamic-field-input / task-fields-form) renders a
  searchable dropdown showing «code — name» of active rows of that kind;
  stores the entity id. Display components resolve id → «code — name».
- `src/lib/process-fields/*` (field-types labels, coerce, valueColumnFor,
  pivot) extended for the new type/column.

## UI — `/entities`

Sidebar entry «Οντότητες» (main nav group, roles SUPER_ADMIN + ADMIN).
One page with 6 tabs (Προμηθευτές, Πελάτες, Προϊόντα, Κατηγορίες, Χρώματα,
Μεγέθη). Each tab:

- Table with search, isActive badge, code+name (+extra columns per kind),
  external-ref indicators (SoftOne/Woo icons when linked).
- CRUD via dialogs (create/edit/deactivate; hard delete only when no
  ProcessFieldValue references the row).
- «Συγχρονισμός» button per enabled+tested connector (see Sync).
- xlsx: «Πρότυπο» (download template) + «Εισαγωγή» (upload).

## Sync (pull-only)

Manual button per entity per connector; never pushes to third parties.
Upsert precedence: match by external id column → else by `code` → else
create. Reports created/updated counts.

- **SoftOne** (official services only, two-step auth per global rules,
  win1253 decode): CUSTOMER, SUPPLIER (TRDR fields CODE, NAME, AFM, ADDRESS,
  CITY, ZIP, PHONE01, EMAIL, ISACTIVE), ITEM (MTRL: CODE, NAME, MTRCATEGORY,
  PRICEW, PRICER, ISACTIVE), ITECATEGORY. Colors/sizes: not in v1 (tenant
  has no fashion module).
- **WooCommerce** (read-only REST): customers, products (name/sku→code,
  prices, categories), product categories, and attributes `pa_color` /
  `pa_size` (or Greek equivalents) → Color/Size.
- **Magento / OpenCard**: only if the connector is configured & tested;
  same read-only pattern; otherwise the button is hidden. May land as a
  follow-up if the connector configs lack needed endpoints.

## xlsx import/export

Uses existing `exceljs` dependency. Per entity: template download with
exact Greek column headers (Κωδικός*, Όνομα*, … per model) and upload
(multipart form → server action/route handler) that validates rows,
upserts by code, and returns a per-row report (created / updated / errors
with row numbers). Max 5.000 rows per upload.

## Demo data integration

`buildSamplePools()` (Data Migration) additionally samples from local
`Customer`/`Product` tables when non-empty, taking precedence over
fallback pools (connector fetch stays as-is).

## Security

All actions require SUPER_ADMIN or ADMIN (`requireRole`). Sync/xlsx are
mutations of local data only. Connector secrets never reach the client.

## Files (planned)

- `prisma/schema.prisma` — 6 models + EntityKind + FieldType.ENTITY +
  ProcessFieldDefinition.entityKind + ProcessFieldValue.valueEntityId
- `src/lib/entities/registry.ts` — per-kind metadata (labels, columns,
  xlsx headers, prisma delegate accessors)
- `src/lib/entities/xlsx.ts` — template build + parse/validate (exceljs)
- `src/lib/entities/sync-softone.ts`, `sync-woo.ts` — pull mappers
- `src/app/(app)/entities/page.tsx`, `entities-client.tsx`, `actions.ts`
- `src/app/api/entities/xlsx/route.ts` — upload endpoint (multipart)
- Process-fields touchpoints: `field-types.ts`, `coerce.ts`, `pivot*.ts`,
  `dynamic-field-input.tsx`, `task-fields-form.tsx`, template wizard
  `step-fields.tsx`, `process-templates/actions.ts` (field create/update)
- `src/lib/nav-config.ts`, `breadcrumb-config.ts`
- `src/lib/demo-connector-sample.ts` — local-table sampling

## Testing

- Unit: entities registry (xlsx header/row mapping round-trip), xlsx parse
  validation (missing code/name, duplicate codes), sync upsert precedence
  (external id → code → create) with mocked rows, coerce/pivot for ENTITY.
- Manual: CRUD each kind, xlsx template+import, Woo sync (if configured),
  ENTITY field end-to-end: define in template → fill in instance →
  timeline/report shows «code — name».
