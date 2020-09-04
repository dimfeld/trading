import { Dictionary } from 'lodash';
import { ColumnSet } from 'pg-promise';

export function getTableDetails(schema: string, table: string) {}

function getTableOids() {
  let query = `SELECT c.oid,
  n.nspname,
  c.relname
FROM pg_catalog.pg_class c
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname OPERATOR(pg_catalog.~) '^(simple)$'
  AND pg_catalog.pg_table_is_visible(c.oid)
ORDER BY 2, 3;
`;
}

async function getTables(tables: string[]): Promise<Dictionary<ColumnSet>> {
  let output: Dictionary<ColumnSet> = {};

  return output;
}
