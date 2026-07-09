import type { FieldType } from "@prisma/client";

export function sanitizeIdentifier(raw: string): string {
  const s = raw
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "col";
}

type ViewField = { id: string; key: string; type: FieldType };

function valueExpr(type: FieldType): string {
  switch (type) {
    case "NUMBER": return "fv.valueNumber";
    case "DATE": return "fv.valueDate";
    case "BOOLEAN": return "fv.valueBool";
    case "SELECT": return "(SELECT li.label FROM LookupListItem li WHERE li.id = fv.valueListItemId)";
    default: return "fv.valueString";
  }
}

/** id values come from cuid (safe); key is sanitized. */
export function buildPivotViewSql(templateId: string, fields: ViewField[]): string {
  if (!/^[a-z0-9]+$/i.test(templateId)) throw new Error("Invalid template id");
  const viewName = `process_data_${sanitizeIdentifier(templateId)}`;
  const seen = new Map<string, string>();
  const cols = fields.map((f) => {
    const alias = sanitizeIdentifier(f.key);
    const prev = seen.get(alias);
    if (prev !== undefined && prev !== f.key)
      throw new Error(`Duplicate sanitized column alias "${alias}" from fields "${prev}" and "${f.key}"`);
    seen.set(alias, f.key);
    return `MAX(CASE WHEN fv.fieldDefinitionId = '${f.id}' THEN ${valueExpr(f.type)} END) AS \`${alias}\``;
  });
  const select = [
    "pi.id AS process_instance_id",
    "pi.name AS process_name",
    "pi.status AS status",
    "pi.startDateTime AS start_date",
    ...cols,
  ].join(",\n  ");
  return (
    `CREATE OR REPLACE VIEW \`${viewName}\` AS\n` +
    `SELECT\n  ${select}\n` +
    `FROM ProcessInstance pi\n` +
    `LEFT JOIN ProcessFieldValue fv ON fv.processInstanceId = pi.id\n` +
    `WHERE pi.processTemplateId = '${templateId}'\n` +
    `GROUP BY pi.id;`
  );
}
