import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LAMINAS_DIR = path.join(ROOT, 'laminas');
const OUTPUT_PATH = path.join(ROOT, 'db', 'seed.sql');

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function unescapeSql(value) {
  return String(value).replace(/''/g, "'");
}

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readLaminaFiles() {
  return fs
    .readdirSync(LAMINAS_DIR)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function readExistingSeedFileOrder() {
  if (!fs.existsSync(OUTPUT_PATH)) return [];

  const sql = fs.readFileSync(OUTPUT_PATH, 'utf8');
  const ordered = [];
  const seen = new Set();
  const pathRegex = /'laminas\/((?:''|[^'])+\.png)'/g;

  for (const match of sql.matchAll(pathRegex)) {
    const safeFile = unescapeSql(match[1]);
    if (seen.has(safeFile)) continue;
    seen.add(safeFile);
    ordered.push(safeFile);
  }

  return ordered;
}

function orderLaminaFiles(files) {
  const filesBySafeName = new Map(files.map(file => [stripDiacritics(file), file]));
  const ordered = [];

  for (const safeFile of readExistingSeedFileOrder()) {
    const file = filesBySafeName.get(safeFile);
    if (!file) continue;
    ordered.push(file);
    filesBySafeName.delete(safeFile);
  }

  const newFiles = [...filesBySafeName.values()]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  return [...ordered, ...newFiles];
}

function buildSql(files) {
  const lines = [];

  lines.push('-- Auto-generated from laminas/*.png');
  lines.push('-- Run this after db/schema.sql.');
  lines.push('');
  lines.push('insert into public.usuarios (id, name, login_name, login_password, lamina_path) values');
  lines.push(
    files.map((file, index) => {
      const safeFile = stripDiacritics(file);
      const baseName = safeFile.slice(0, -4);
      const suffix = index === files.length - 1 ? '' : ',';
      return `  (${index + 1}, '${escapeSql(baseName)}', '${escapeSql(baseName)}', '${escapeSql(baseName)}', 'laminas/${escapeSql(safeFile)}')${suffix}`;
    }).join('\n'),
  );
  lines.push('on conflict (id) do update set');
  lines.push('  name = excluded.name,');
  lines.push('  login_name = excluded.login_name,');
  lines.push('  login_password = excluded.login_password,');
  lines.push('  lamina_path = excluded.lamina_path;');
  lines.push('');
  lines.push('insert into public.figuritas (id, user_id, foto_path) values');
  lines.push(
    files.map((file, index) => {
      const suffix = index === files.length - 1 ? '' : ',';
      return `  (${index + 1}, ${index + 1}, 'laminas/${escapeSql(stripDiacritics(file))}')${suffix}`;
    }).join('\n'),
  );
  lines.push('on conflict (id) do update set');
  lines.push('  user_id = excluded.user_id,');
  lines.push('  foto_path = excluded.foto_path;');
  lines.push('');
  lines.push("select setval(pg_get_serial_sequence('public.usuarios', 'id'), (select max(id) from public.usuarios), true);");
  lines.push("select setval(pg_get_serial_sequence('public.figuritas', 'id'), (select max(id) from public.figuritas), true);");
  lines.push('');

  return lines.join('\n');
}

const files = orderLaminaFiles(readLaminaFiles());

if (!files.length) {
  throw new Error(`No PNG files found in ${LAMINAS_DIR}`);
}

fs.writeFileSync(OUTPUT_PATH, `${buildSql(files)}\n`);
console.log(`Wrote ${OUTPUT_PATH} with ${files.length} usuarios/figuritas.`);
