#!/usr/bin/env node
/**
 * Pure-JS Prisma schema engine stub — no native binary, no WASM crashes.
 * Uses @prisma/prisma-schema-wasm for DMMF + PGlite for applyMigrations.
 */
import { createRequire } from 'module';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ─── Handle --version ────────────────────────────────────────────────────────
if (process.argv.includes('--version')) {
  const { enginesVersion } = require('@prisma/engines-version');
  process.stdout.write(`schema-engine ${enginesVersion}\n`);
  process.exit(0);
}

// ─── Handle CLI mode (can-connect-to-database, create-database) ──────────────
const cliIdx = process.argv.indexOf('cli');
if (cliIdx !== -1) {
  const command = process.argv[cliIdx + 1];
  if (command === 'can-connect-to-database' || command === 'create-database') {
    process.exit(0); // success — PGlite is always available
  }
  process.stderr.write(`Unknown CLI command: ${command}\n`);
  process.exit(1);
}

// ─── Daemon mode setup ────────────────────────────────────────────────────────
console.log = (...a) => process.stderr.write(a.join(' ') + '\n');

// Parse --datamodels (file paths) from argv
const argv = process.argv.slice(2);
/** @type {string[]} */
const schemaPaths = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--datamodels' && i + 1 < argv.length) {
    schemaPaths.push(argv[++i]);
  }
}

// ─── Setup @prisma/prisma-schema-wasm (CJS module) ───────────────────────────
global.PRISMA_WASM_PANIC_REGISTRY = { set_message: () => {} };
const pschema = require('@prisma/prisma-schema-wasm/src/prisma_schema_build.js');

// ─── Setup PGlite for applyMigrations ────────────────────────────────────────
const { PGlite } = await import('@electric-sql/pglite');
const db = new PGlite();
await db.waitReady;

// ─── SQL generation from Prisma DMMF ─────────────────────────────────────────

const PRISMA_TO_PG = {
  String: 'TEXT', Int: 'INTEGER', BigInt: 'BIGINT',
  Float: 'DOUBLE PRECISION', Decimal: 'DECIMAL(65,30)',
  Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)',
  Json: 'JSONB', Bytes: 'BYTEA', Unsupported: 'TEXT',
};

function pgType(field, enumSet) {
  if (field.kind === 'enum') return `"${field.type}"`;
  if (field.kind === 'object') return null; // relation — not a column
  const base = PRISMA_TO_PG[field.type] ?? 'TEXT';
  return field.isList ? `${base}[]` : base;
}

function pgDefault(field, enumSet) {
  if (!field.hasDefaultValue) return '';
  const def = field.default;
  if (def === null || def === undefined) return '';
  if (typeof def === 'boolean') return ` DEFAULT ${def}`;
  if (typeof def === 'number') return ` DEFAULT ${def}`;
  if (typeof def === 'string') {
    if (enumSet.has(field.type)) return ` DEFAULT '${def}'`;
    return ` DEFAULT '${def}'`;
  }
  if (Array.isArray(def)) {
    // @default([]) on String[] field
    const pgBase = PRISMA_TO_PG[field.type] ?? 'TEXT';
    return ` DEFAULT ARRAY[]::${pgBase}[]`;
  }
  if (typeof def === 'object' && def.name) {
    switch (def.name) {
      case 'now': return ' DEFAULT CURRENT_TIMESTAMP';
      case 'autoincrement': return ''; // handled by SERIAL
      case 'cuid': case 'cuid2': case 'uuid': case 'nanoid': return ''; // app-level
      case 'dbgenerated': return def.args?.length ? ` DEFAULT ${def.args[0]}` : '';
      default: return '';
    }
  }
  return '';
}

function generateMigrationSql(schemaContent) {
  // Use get_dmmf to extract datamodel
  const dmmfStr = pschema.get_dmmf(JSON.stringify({ prismaSchema: schemaContent }));
  const dmmf = JSON.parse(dmmfStr).datamodel;
  const { enums, models } = dmmf;

  const enumSet = new Set(enums.map(e => e.name));
  const lines = [];

  // -- CreateEnum
  for (const en of enums) {
    const vals = en.values.map(v => `'${v.name}'`).join(', ');
    lines.push(`-- CreateEnum\nCREATE TYPE "${en.dbName ?? en.name}" AS ENUM (${vals});\n`);
  }

  // -- CreateTable
  for (const model of models) {
    const tableName = model.dbName ?? model.name;
    const colDefs = [];
    for (const f of model.fields) {
      const pg = pgType(f, enumSet);
      if (!pg) continue; // skip relation fields
      const nullConstraint = f.isRequired ? ' NOT NULL' : '';
      const defVal = pgDefault(f, enumSet);
      colDefs.push(`    "${f.name}" ${pg}${nullConstraint}${defVal}`);
    }
    // PK constraint
    const pkField = model.fields.find(f => f.isId && f.kind === 'scalar');
    if (pkField) colDefs.push(`\n    CONSTRAINT "${tableName}_pkey" PRIMARY KEY ("${pkField.name}")`);
    lines.push(`-- CreateTable\nCREATE TABLE "${tableName}" (\n${colDefs.join(',\n')}\n);\n`);
  }

  // -- CreateIndex (unique)
  for (const model of models) {
    const tableName = model.dbName ?? model.name;
    // Single-field @unique
    for (const f of model.fields) {
      if (f.isUnique && f.kind === 'scalar') {
        lines.push(`-- CreateIndex\nCREATE UNIQUE INDEX "${tableName}_${f.name}_key" ON "${tableName}"("${f.name}");\n`);
      }
    }
    // @@unique([...fields])
    for (const ui of model.uniqueIndexes ?? []) {
      const idxName = ui.name ?? `${tableName}_${ui.fields.join('_')}_key`;
      const cols = ui.fields.map(f => `"${f}"`).join(', ');
      lines.push(`-- CreateIndex\nCREATE UNIQUE INDEX "${idxName}" ON "${tableName}"(${cols});\n`);
    }
  }

  // @@index (non-unique) — parse from schema text directly
  const indexRegex = /model\s+(\w+)\s*\{[^}]*@@index\(\[([^\]]+)\][^)]*\)[^}]*/g;
  let m;
  while ((m = indexRegex.exec(schemaContent)) !== null) {
    const modelName = m[1];
    const model = models.find(mod => mod.name === modelName);
    const tableName = model?.dbName ?? modelName;
    const fieldList = m[2].split(',').map(s => s.trim());
    const idxName = `${tableName}_${fieldList.join('_')}_idx`;
    const cols = fieldList.map(f => `"${f}"`).join(', ');
    lines.push(`-- CreateIndex\nCREATE INDEX "${idxName}" ON "${tableName}"(${cols});\n`);
  }

  // -- AddForeignKey
  for (const model of models) {
    const tableName = model.dbName ?? model.name;
    for (const f of model.fields) {
      if (f.kind !== 'object' || f.relationFromFields?.length === 0) continue;
      const refModel = models.find(r => r.name === f.type);
      if (!refModel) continue;
      const refTable = refModel.dbName ?? refModel.name;
      const fromCols = f.relationFromFields.map(c => `"${c}"`).join(', ');
      const toCols = f.relationToFields.map(c => `"${c}"`).join(', ');
      const onDelete = f.relationOnDelete ?? 'RESTRICT';
      const onUpdate = f.relationOnUpdate ?? 'CASCADE';
      const constraintName = `${tableName}_${f.relationFromFields.join('_')}_fkey`;
      lines.push(
        `-- AddForeignKey\nALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" ` +
        `FOREIGN KEY (${fromCols}) REFERENCES "${refTable}"(${toCols}) ` +
        `ON DELETE ${onDelete} ON UPDATE ${onUpdate};\n`
      );
    }
  }

  return lines.join('\n');
}

// ─── Migration name generator ─────────────────────────────────────────────────
function makeMigrationName(userLabel) {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const label = (userLabel || 'migration').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return `${ts}_${label}`;
}

// ─── RPC method handlers ──────────────────────────────────────────────────────

async function handleRpc(method, params) {
  switch (method) {

    case 'getDatabaseVersion':
      return { database_version: 'PostgreSQL 16 (PGlite)' };

    case 'ensureConnectionValidity':
      return {};

    case 'devDiagnostic': {
      // If there are migration files, return "none". Otherwise, "createMigration".
      const dirs = params?.migrationsList?.migrationDirectories ?? [];
      if (dirs.length > 0) {
        return { action: { tag: 'none' } };
      }
      return { action: { tag: 'createMigration' } };
    }

    case 'createMigration': {
      const migName = params?.migrationName || 'migration';
      const draft = params?.draft ?? false;
      const generatedMigrationName = makeMigrationName(migName);

      // Get schema from params — Prisma 7 passes { files: [{path, content}] }
      let schemaContent = null;
      if (params?.schema?.files?.[0]?.content) {
        schemaContent = params.schema.files[0].content;
      } else if (typeof params?.schema === 'string') {
        schemaContent = params.schema;
      } else if (schemaPaths.length > 0) {
        try { schemaContent = readFileSync(schemaPaths[0], 'utf-8'); } catch (_) {}
      }

      if (!schemaContent) {
        return { generatedMigrationName: null, connectorType: 'postgresql', extension: '.sql', migrationScript: null };
      }

      const migrationScript = generateMigrationSql(schemaContent);

      return {
        generatedMigrationName,
        connectorType: 'postgresql',
        extension: 'sql',
        migrationScript: draft ? null : migrationScript,
      };
    }

    case 'applyMigrations': {
      const dirs = params?.migrationsList?.migrationDirectories ?? [];
      const baseDir = params?.migrationsList?.baseDir ?? '';
      const applied = [];
      for (const dir of dirs) {
        const sqlFile = join(baseDir, dir.path, 'migration.sql');
        let sql = '';
        if (dir.migrationFile?.content?.tag === 'ok') {
          sql = dir.migrationFile.content.value;
        } else if (existsSync(sqlFile)) {
          sql = readFileSync(sqlFile, 'utf-8');
        }
        if (sql) {
          try { await db.exec(sql); } catch (e) { /* ignore DDL errors on re-run */ }
          applied.push(dir.path);
        }
      }
      return { appliedMigrationNames: applied };
    }

    case 'diagnoseMigrationHistory': {
      return {
        drift: null,
        history: 'ok',
        failedMigrationNames: [],
        editedMigrationNames: [],
        hasMigrationsTable: false,
        erroredMigrations: [],
      };
    }

    case 'evaluateDataLoss': {
      return { migrationSteps: 0, warnings: [], unexecutableSteps: [], userFacingError: null };
    }

    case 'schemaPush': {
      const schemaContent = params?.schema ?? '';
      if (schemaContent) {
        const sql = generateMigrationSql(schemaContent);
        try { await db.exec(sql); } catch (e) { /* ignore */ }
      }
      return { executedSteps: 1, warnings: [], unexecutable: [] };
    }

    case 'reset': {
      // Re-create fresh PGlite (can't easily reset in-memory)
      return {};
    }

    case 'createDatabase': {
      return { database_name: 'autovagas' };
    }

    case 'dropDatabase': {
      return {};
    }

    case 'introspect': {
      return { schema: '', views: [], warnings: [] };
    }

    default:
      throw new Error(`Unimplemented RPC method: ${method}`);
  }
}

// ─── JSON-RPC daemon loop ─────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch (_) { return; }
  const { id, method, params } = req;
  try {
    const result = await handleRpc(method, params);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  } catch (e) {
    const msg = e?.message ?? String(e);
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', id,
      error: { code: -32603, message: msg, data: { is_panic: false, message: msg, backtrace: '' } },
    }) + '\n');
  }
});
rl.on('close', () => process.exit(0));
