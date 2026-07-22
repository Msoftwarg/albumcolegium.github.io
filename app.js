const SUPABASE_URL = 'https://qsnlddtwclwhwiowoskr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xOpZAN1La7mlmnkFlZGDJA_W_iDhdXD';
const HAS_SUPABASE_CONFIG =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('PUT_') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('PUT_') &&
  typeof window.supabase !== 'undefined';

const supabaseClient = HAS_SUPABASE_CONFIG
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const BG_COLORS = [
  '#1a3a6b', '#2d1b4e', '#1a4a2e', '#4a1a1a', '#1a3a4a', '#3a2d1b',
  '#1a2d3a', '#2d3a1b', '#3a1a3a', '#1a4a3a', '#3a3a1b', '#1b3a1a',
  '#3a1a2d', '#1a2a4a', '#2a3a1a', '#3a2a1b', '#1a1a4a', '#4a2a1a',
  '#1a4a1a', '#2a1a4a', '#3a1b1a', '#1a3b2a', '#2a4a1a', '#1a2a3a',
];
const SECRET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FETCH_PAGE_SIZE = 1000;

const UI_PREFS_KEY = 'colegium_album_ui_v1';
const AUTH_SESSION_KEY = 'colegium_album_auth_v1';
const CODES_ACCESS_KEY = 'colegium_album_codes_access_v1';
const CODES_ACCESS_CODE = 'aguantecolegium';

const TEAM_SEED = [
  { id: 1, name: 'Ariel G.' },
  { id: 2, name: 'Valentina R.' },
  { id: 3, name: 'Diego M.' },
  { id: 4, name: 'Camila F.' },
  { id: 5, name: 'Matias L.' },
  { id: 6, name: 'Sofia P.' },
  { id: 7, name: 'Andres C.' },
  { id: 8, name: 'Isabella T.' },
  { id: 9, name: 'Lucas H.' },
  { id: 10, name: 'Martina V.' },
  { id: 11, name: 'Felipe O.' },
  { id: 12, name: 'Gabriela N.' },
  { id: 13, name: 'Sebastian A.' },
  { id: 14, name: 'Catalina B.' },
  { id: 15, name: 'Pablo E.' },
  { id: 16, name: 'Natalia S.' },
  { id: 17, name: 'Rodrigo J.' },
  { id: 18, name: 'Alejandra U.' },
  { id: 19, name: 'Tomas I.' },
  { id: 20, name: 'Daniela Q.' },
  { id: 21, name: 'Ignacio W.' },
  { id: 22, name: 'Florencia K.' },
  { id: 23, name: 'Cristobal Z.' },
  { id: 24, name: 'Maria Jose X.' },
];

let APP = createEmptyApp();
let DB_MODE = supabaseClient ? 'remote' : 'demo';
let currentUserId = null;
let currentView = 'mi-album';
let currentFilter = 'all';
let selectedOffer = new Set();
let selectedRequest = new Set();
let pendingStickerId = null;
let codesAccessGranted = false;
let secretCodesRows = [];
let secretCodesLoaded = false;
let secretCodesLoading = false;
let pendingValidationRows = [];
let pendingValidationLoaded = false;
let pendingValidationLoading = false;
let validationRunStatus = 'Listo para correr.';
let validationRunLoading = false;
let toastTimeout = null;
let tradePickLoadToken = 0;

function createEmptyApp() {
  return {
    usuarios: [],
    figuritas: [],
    usuarioFiguritas: [],
    validacionesSecretas: [],
    intercambios: [],
    intercambioItems: [],
    mensajes: [],
    comentarios: [],
    usuariosById: new Map(),
    figuritasById: new Map(),
    ownedByUser: {},
    ownedSummaryByUser: new Map(),
    tradeOwnedByUser: new Map(),
    pendingByUser: {},
    validacionesSecretasById: new Map(),
    tradeItemsByTrade: new Map(),
    stickers: [],
  };
}

function loadUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUiPrefs() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      currentView,
      currentFilter,
    }));
  } catch {
    // ignore
  }
}

function usingRemoteDb() {
  return DB_MODE === 'remote' && Boolean(supabaseClient);
}

function seededFraction(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function initialsFromName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
}

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function generateDemoSecretCode(seed, length = 8) {
  let value = Math.abs(Math.floor(seed)) + 1;
  let code = '';

  for (let i = 0; i < length; i += 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    code += SECRET_CODE_ALPHABET[value % SECRET_CODE_ALPHABET.length];
  }

  return code;
}

function normalizeStickerCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function sortByIdAscending(a, b) {
  return Number(a.id) - Number(b.id);
}

function sortByCreatedAtDesc(a, b) {
  return new Date(b.created_at || 0) - new Date(a.created_at || 0);
}

function countDistinctOwned(ownedMap) {
  return Object.values(ownedMap || {}).filter(qty => Number(qty) > 0).length;
}

function countDuplicateTypes(ownedMap) {
  return Object.values(ownedMap || {}).filter(qty => Number(qty) > 1).length;
}

function getOwnedMap(userId) {
  return APP.ownedByUser[userId] || {};
}

function getOwnedCountForRanking(userId) {
  const summary = APP.ownedSummaryByUser?.get(Number(userId));
  if (Number.isFinite(summary)) return Number(summary);
  return countDistinctOwned(getOwnedMap(userId));
}

function getTradeOwnedMap(userId) {
  return APP.tradeOwnedByUser?.get(Number(userId)) || {};
}

function getPendingValidation(userId, figuritaId) {
  return APP.pendingByUser?.[Number(userId)]?.[Number(figuritaId)] || null;
}

function getStickerById(id) {
  return APP.figuritasById.get(Number(id)) || null;
}

function getUserById(id) {
  return APP.usuariosById.get(Number(id)) || null;
}

function deriveStickerLaminaPath(name) {
  const normalizedName = stripDiacritics(name || '').trim();
  if (!normalizedName) return '';
  return `laminas/${normalizedName}.png`;
}

function resolveStickerImagePath(sticker) {
  if (!sticker) return '';

  const candidates = [
    sticker.foto_path,
    sticker.lamina_path,
    sticker.user?.lamina_path,
    sticker.user?.name ? deriveStickerLaminaPath(sticker.user.name) : '',
    sticker.name ? deriveStickerLaminaPath(sticker.name) : '',
  ];

  const rawPath = candidates.find(value => String(value || '').trim()) || '';
  if (!rawPath) return '';

  const trimmed = String(rawPath).trim();
  try {
    return encodeURI(decodeURI(trimmed));
  } catch {
    return trimmed;
  }
}

function buildFallbackData() {
  const usuarios = TEAM_SEED.map(user => ({
    id: user.id,
    name: stripDiacritics(user.name),
    login_name: stripDiacritics(user.name),
    login_password: stripDiacritics(user.name),
    lamina_path: '',
  }));

  const figuritas = usuarios.map(user => ({
    id: user.id,
    user_id: user.id,
    foto_path: '',
    secret_code: generateDemoSecretCode(user.id * 997),
  }));

  const usuarioFiguritas = [];
  usuarios.forEach(user => {
    figuritas.forEach(figurita => {
      const fraction = seededFraction(user.id * 1000 + figurita.id * 17);
      if (fraction < 0.55) {
        usuarioFiguritas.push({
          user_id: user.id,
          figurita_id: figurita.id,
          cantidad: 1,
          veces_pedidas: 0,
          created_at: new Date().toISOString(),
        });
      } else if (fraction < 0.72) {
        usuarioFiguritas.push({
          user_id: user.id,
          figurita_id: figurita.id,
          cantidad: 2,
          veces_pedidas: 0,
          created_at: new Date().toISOString(),
        });
      }
    });
  });

  return {
    usuarios,
    figuritas,
    usuarioFiguritas,
    validacionesSecretas: [],
    intercambios: [],
    intercambioItems: [],
    mensajes: [],
    comentarios: [],
    tradeOwnedByUser: new Map(),
  };
}

async function fetchTable(table, orderColumn = 'id', ascending = true, columns = '*') {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending })
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data || [];
    rows.push(...page);

    if (page.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return rows;
}

async function fetchUserFiguritasRows(userId) {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) return [];

  if (usingRemoteDb()) {
    try {
      const { data, error } = await supabaseClient.rpc('listar_usuario_figuritas_por_usuario', {
        p_user_id: numericUserId,
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('No se pudo cargar listar_usuario_figuritas_por_usuario por RPC; se intenta con tabla filtrada.', error);
      try {
        const { data, error: tableError } = await supabaseClient
          .from('usuario_figuritas')
          .select('user_id,figurita_id,cantidad,veces_pedidas,created_at')
          .eq('user_id', numericUserId)
          .order('created_at', { ascending: true });
        if (tableError) throw tableError;
        return data || [];
      } catch (tableError) {
        console.warn('No se pudieron cargar usuario_figuritas filtradas desde la DB.', tableError);
        return [];
      }
    }
  }

  return APP.usuarioFiguritas
    .filter(row => Number(row.user_id) === numericUserId)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

async function fetchOwnedSummaryRows() {
  if (usingRemoteDb()) {
    try {
      const { data, error } = await supabaseClient.rpc('listar_resumen_usuario_figuritas');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('No se pudo cargar listar_resumen_usuario_figuritas.', error);
      return [];
    }
  }

  const summary = new Map();
  APP.usuarioFiguritas.forEach(row => {
    if (Number(row.cantidad) > 0) {
      const userId = Number(row.user_id);
      summary.set(userId, (summary.get(userId) || 0) + 1);
    }
  });

  return [...summary.entries()].map(([user_id, figuritas_distintas]) => ({
    user_id,
    figuritas_distintas,
  }));
}

async function fetchRemoteRows({ rpcName, table, orderColumn = 'id', ascending = true, columns = '*' }) {
  if (rpcName) {
    try {
      const { data, error } = await supabaseClient.rpc(rpcName);
      if (!error) return data || [];
      console.warn(`No se pudo cargar ${rpcName} por RPC; se intenta con tabla.`, error);
    } catch (error) {
      console.warn(`No se pudo cargar ${rpcName} por RPC; se intenta con tabla.`, error);
    }
  }

  try {
    return await fetchTable(table, orderColumn, ascending, columns);
  } catch (error) {
    console.warn(`No se pudieron cargar ${table} desde la DB.`, error);
    return [];
  }
}

async function loadRemoteData() {
  const usuarios = await fetchTable('usuarios', 'id');

  let figuritas;
  try {
    figuritas = await fetchTable('figuritas', 'id', true, 'id,user_id,foto_path');
  } catch (error) {
    console.warn('No se pudieron cargar figuritas desde la DB; se derivan desde usuarios.', error);
    figuritas = usuarios.map(user => ({
      id: Number(user.id),
      user_id: Number(user.id),
      foto_path: stripDiacritics(user.lamina_path || ''),
      secret_code: generateDemoSecretCode(user.id * 997),
    }));
  }

  const [
    usuarioFiguritas,
    ownedSummaryRows,
    validacionesSecretas,
    intercambios,
    intercambioItems,
    mensajes,
    comentarios,
  ] = await Promise.all([
    fetchUserFiguritasRows(currentUserId),
    fetchOwnedSummaryRows(),
    fetchRemoteRows({ rpcName: 'listar_validaciones_secretas_pendientes', table: 'validaciones_secretas', orderColumn: 'created_at' }),
    fetchRemoteRows({ table: 'intercambios', orderColumn: 'created_at' }),
    fetchRemoteRows({ table: 'intercambio_items', orderColumn: 'id' }),
    fetchRemoteRows({ table: 'mensajes', orderColumn: 'created_at' }),
    fetchRemoteRows({ table: 'comentarios', orderColumn: 'created_at' }),
  ]);

  if (currentUserId != null) {
    console.log('[debug] usuarioFiguritas current user', {
      currentUserId: Number(currentUserId),
      loadedRows: usuarioFiguritas.length,
      rows: usuarioFiguritas,
    });
  }

  APP = {
    usuarios,
    figuritas,
    usuarioFiguritas,
    validacionesSecretas,
    intercambios,
    intercambioItems,
    mensajes,
    comentarios,
    usuariosById: new Map(),
    figuritasById: new Map(),
    ownedByUser: {},
    ownedSummaryByUser: new Map(),
    tradeOwnedByUser: new Map(),
    pendingByUser: {},
    validacionesSecretasById: new Map(),
    tradeItemsByTrade: new Map(),
    stickers: [],
  };

  APP.ownedSummaryByUser = new Map((ownedSummaryRows || []).map(row => [
    Number(row.user_id),
    Number(row.figuritas_distintas) || 0,
  ]));
}

function rebuildDerivedData() {
  APP.usuarios = [...APP.usuarios]
    .map(user => ({
      ...user,
      name: stripDiacritics(user.name),
      login_name: stripDiacritics(user.login_name || user.name || ''),
      login_password: stripDiacritics(user.login_password || user.login_name || user.name || ''),
      lamina_path: stripDiacritics(user.lamina_path || ''),
    }))
    .sort(sortByIdAscending);
  APP.figuritas = [...APP.figuritas]
    .map(figurita => ({
      ...figurita,
      foto_path: stripDiacritics(figurita.foto_path || ''),
      secret_code: figurita.secret_code || '',
    }))
    .sort(sortByIdAscending);
  APP.usuarioFiguritas = [...APP.usuarioFiguritas].map(row => ({
    ...row,
    user_id: Number(row.user_id),
    figurita_id: Number(row.figurita_id),
    cantidad: Number(row.cantidad) || 0,
    veces_pedidas: Number(row.veces_pedidas) || 0,
  }));
  APP.validacionesSecretas = [...APP.validacionesSecretas]
    .map(row => ({
      ...row,
      id: Number(row.id),
      user_id: Number(row.user_id),
      figurita_id: Number(row.figurita_id),
      responded_by_user_id: row.responded_by_user_id == null ? null : Number(row.responded_by_user_id),
      status: row.status || 'pending',
    }))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  APP.intercambios = [...APP.intercambios].sort(sortByCreatedAtDesc);
  APP.intercambioItems = [...APP.intercambioItems];
  APP.mensajes = [...APP.mensajes].sort(sortByCreatedAtDesc);
  APP.comentarios = [...APP.comentarios].sort(sortByCreatedAtDesc);

  APP.usuariosById = new Map(APP.usuarios.map(u => {
    const enriched = {
      id: Number(u.id),
      name: u.name,
      login_name: u.login_name || '',
      login_password: u.login_password || '',
      lamina_path: u.lamina_path || '',
      initials: initialsFromName(u.name),
    };
    return [enriched.id, enriched];
  }));

  APP.figuritasById = new Map(APP.figuritas.map(f => {
    const user = APP.usuariosById.get(Number(f.user_id)) || null;
    const fotoPath = resolveStickerImagePath({
      foto_path: f.foto_path,
      lamina_path: user?.lamina_path || '',
      user,
      name: user?.name || `Usuario ${f.user_id}`,
    });
    const enriched = {
      id: Number(f.id),
      user_id: Number(f.user_id),
      foto_path: fotoPath,
      secret_code: f.secret_code || '',
      lamina_path: user?.lamina_path || '',
      user,
      name: user?.name || `Usuario ${f.user_id}`,
      initials: initialsFromName(user?.name || `#${f.id}`),
    };
    return [enriched.id, enriched];
  }));

  APP.validacionesSecretasById = new Map(APP.validacionesSecretas.map(row => [row.id, row]));

  APP.ownedByUser = {};
  APP.usuarioFiguritas.forEach(row => {
    const userId = Number(row.user_id);
    const figuritaId = Number(row.figurita_id);
    const cantidad = Number(row.cantidad) || 0;
    if (!APP.ownedByUser[userId]) APP.ownedByUser[userId] = {};
    if (cantidad > 0) APP.ownedByUser[userId][figuritaId] = cantidad;
  });

  APP.pendingByUser = {};
  APP.validacionesSecretas.forEach(row => {
    if (row.status !== 'pending') return;
    if (!APP.pendingByUser[row.user_id]) APP.pendingByUser[row.user_id] = {};
    APP.pendingByUser[row.user_id][row.figurita_id] = row;
  });

  APP.tradeItemsByTrade = new Map();
  APP.intercambioItems.forEach(item => {
    const tradeId = Number(item.intercambio_id);
    const side = item.side;
    if (!APP.tradeItemsByTrade.has(tradeId)) {
      APP.tradeItemsByTrade.set(tradeId, { offer: [], request: [] });
    }
    const bucket = APP.tradeItemsByTrade.get(tradeId);
    if (side === 'offer') bucket.offer.push(Number(item.figurita_id));
    if (side === 'request') bucket.request.push(Number(item.figurita_id));
  });

  APP.intercambios = APP.intercambios.map(trade => {
    const sides = APP.tradeItemsByTrade.get(Number(trade.id)) || { offer: [], request: [] };
    return {
      ...trade,
      id: Number(trade.id),
      from_user_id: Number(trade.from_user_id),
      to_user_id: Number(trade.to_user_id),
      offer: sides.offer,
      request: sides.request,
    };
  });

  APP.stickers = APP.figuritas.map(figurita => {
    const user = APP.usuariosById.get(Number(figurita.user_id));
    const fotoPath = resolveStickerImagePath({
      foto_path: figurita.foto_path,
      lamina_path: user?.lamina_path || '',
      user,
      name: user?.name || `Usuario ${figurita.user_id}`,
    });
    return {
      id: Number(figurita.id),
      user_id: Number(figurita.user_id),
      foto_path: fotoPath,
      secret_code: figurita.secret_code || '',
      lamina_path: user?.lamina_path || '',
      user,
      name: user?.name || `Usuario ${figurita.user_id}`,
      initials: initialsFromName(user?.name || `#${figurita.id}`),
    };
  });

  APP.tradeOwnedByUser = new Map();
}

function hydrateUiState() {
  const prefs = loadUiPrefs();
  currentView = prefs.currentView || 'mi-album';
  currentFilter = prefs.currentFilter || 'all';
  currentUserId = loadAuthSession();
  codesAccessGranted = loadCodesAccess();
}

function normalizeCredential(value) {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function resetValidationRunState() {
  validationRunStatus = 'Listo para correr.';
  validationRunLoading = false;
}

function columnLabelToIndex(label) {
  const normalized = String(label || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

  if (!normalized) return -1;

  let index = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    index = (index * 26) + (normalized.charCodeAt(i) - 64);
  }
  return index - 1;
}

function getValidationSheetMapping() {
  return {
    userColumn: 'B',
    userRow: 1,
    laminaColumn: 'F',
    laminaRow: 1,
  };
}

const VALIDATION_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bVScFcc4jGKN3kNnL1wmK7GY8HG322UKSMVJpEcksnI/export?format=csv&gid=0';

function sheetMatrixToValidationRows(matrix, mapping) {
  const userColumnIndex = columnLabelToIndex(mapping.userColumn);
  const laminaColumnIndex = columnLabelToIndex(mapping.laminaColumn);
  if (userColumnIndex < 0 || laminaColumnIndex < 0) {
    return [];
  }

  const firstRow = Math.min(mapping.userRow, mapping.laminaRow);
  const userOffset = mapping.userRow - firstRow;
  const laminaOffset = mapping.laminaRow - firstRow;
  const userRows = Math.max(0, matrix.length - mapping.userRow + 1);
  const laminaRows = Math.max(0, matrix.length - mapping.laminaRow + 1);
  const totalRows = Math.max(userRows - userOffset, laminaRows - laminaOffset);
  const rows = [];

  for (let i = 0; i < totalRows; i += 1) {
    const userSheetRow = mapping.userRow + i;
    const laminaSheetRow = mapping.laminaRow + i;
    const userSourceRow = matrix[userSheetRow - 1] || [];
    const laminaSourceRow = matrix[laminaSheetRow - 1] || [];
    const usuario = String(userSourceRow[userColumnIndex] ?? '').trim();
    const lamina = String(laminaSourceRow[laminaColumnIndex] ?? '').trim();

    if (!usuario && !lamina) continue;

    rows.push({
      usuario,
      lamina,
      user_row: userSheetRow,
      lamina_row: laminaSheetRow,
    });
  }

  return rows;
}

function workbookToMatrix(workbook) {
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

async function readValidationSheetRows() {
  if (!window.XLSX) {
    throw new Error('No se pudo cargar el lector de Excel.');
  }

  const response = await fetch(VALIDATION_SHEET_URL, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`No se pudo leer la hoja (${response.status}).`);
  }

  const text = await response.text();
  const workbook = window.XLSX.read(text, { type: 'string' });
  const matrix = workbookToMatrix(workbook);
  const mapping = getValidationSheetMapping();
  return sheetMatrixToValidationRows(matrix, mapping).filter(row => row.usuario || row.lamina);
}

function makeValidationKey(userName, laminaName) {
  const userKey = normalizeCredential(userName);
  const laminaKey = normalizeCredential(laminaName);
  if (!userKey || !laminaKey) return '';
  return `${userKey}|${laminaKey}`;
}

function buildSheetValidationCountMap(rows) {
  const counts = new Map();
  (rows || []).forEach(row => {
    const key = makeValidationKey(row.usuario, row.lamina);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

async function getValidationSheetAllowance(userId, stickerId) {
  const user = getUserById(userId);
  const sticker = getStickerById(stickerId);
  if (!user || !sticker) return 0;

  const rows = await readValidationSheetRows();
  const counts = buildSheetValidationCountMap(rows);
  return counts.get(makeValidationKey(user.name, sticker.name)) || 0;
}

function loadAuthSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function saveAuthSession(userId) {
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, String(userId));
  } catch {
    // ignore
  }
}

function clearAuthSession() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // ignore
  }
}

function loadCodesAccess() {
  try {
    return sessionStorage.getItem(CODES_ACCESS_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCodesAccess(granted) {
  try {
    if (granted) sessionStorage.setItem(CODES_ACCESS_KEY, '1');
    else sessionStorage.removeItem(CODES_ACCESS_KEY);
  } catch {
    // ignore
  }
}

function clearCodesAccess() {
  saveCodesAccess(false);
}

function ensureCurrentUser() {
  if (!currentUserId || !APP.usuariosById.has(currentUserId)) {
    currentUserId = null;
    clearAuthSession();
  }
}

function updateCurrentUserDisplay() {
  const label = document.getElementById('current-user-label');
  if (!label) return;
  const logoutBtn = document.getElementById('logout-btn');

  if (!currentUserId) {
    label.textContent = 'Inicia';
    label.disabled = false;
    label.title = 'Inicia sesión';
    if (logoutBtn) logoutBtn.classList.add('hidden');
    updateCodesButtonState();
    return;
  }

  const user = APP.usuariosById.get(Number(currentUserId));
  label.disabled = true;
  label.textContent = user ? user.name : 'Inicia';
  label.title = user ? `Sesión iniciada: ${user.name}` : 'Inicia sesión';
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  updateCodesButtonState();
}

function updateCodesButtonState() {
  const codesBtn = document.getElementById('codes-btn');
  if (!codesBtn) return;
  codesBtn.classList.toggle('hidden', !currentUserId);
  codesBtn.classList.toggle('active', currentUserId && currentView === 'codigos');
}

function populateMessagePartnerSelect() {
  const select = document.getElementById('message-partner');
  if (!select) return;

  if (!currentUserId) {
    select.innerHTML = '<option value="">Inicia sesión primero</option>';
    select.disabled = true;
    return;
  }

  const prev = select.value;
  select.disabled = false;
  select.innerHTML = '<option value="">Selecciona una persona...</option>';

  APP.usuarios
    .filter(user => user.id !== currentUserId)
    .forEach(user => {
      const option = document.createElement('option');
      option.value = String(user.id);
      option.textContent = user.name;
      select.appendChild(option);
    });

  select.value = prev || '';
}

function populateCommentFiguritaSelect() {
  const select = document.getElementById('comment-figurita');
  if (!select) return;

  const prev = select.value;
  select.innerHTML = '<option value="">Selecciona una figurita...</option>';

  APP.stickers.forEach(sticker => {
    const option = document.createElement('option');
    option.value = String(sticker.id);
    option.textContent = `#${String(sticker.id).padStart(2, '0')} ${sticker.name}`;
    select.appendChild(option);
  });

  select.value = prev || '';
}

function updateBadges() {
  const tradeBadge = document.getElementById('badge-trades');
  const messageBadge = document.getElementById('badge-messages');

  const pendingTrades = APP.intercambios.filter(t => t.to_user_id === currentUserId && t.status === 'pending').length;
  const unreadMessages = APP.mensajes.filter(m => m.to_user_id === currentUserId && !m.is_read).length;

  if (tradeBadge) {
    if (pendingTrades > 0) {
      tradeBadge.style.display = 'inline';
      tradeBadge.textContent = String(pendingTrades);
    } else {
      tradeBadge.style.display = 'none';
    }
  }

  if (messageBadge) {
    if (unreadMessages > 0) {
      messageBadge.style.display = 'inline';
      messageBadge.textContent = String(unreadMessages);
    } else {
      messageBadge.style.display = 'none';
    }
  }
}

function updateNavActive() {
  const btns = document.querySelectorAll('.nav-btn');
  btns.forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-view="${currentView}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function bindNavButtons() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault();
      switchView(btn.dataset.view);
    });
  });
}

function setGuestMode(isGuest) {
  const shell = document.getElementById('app-shell');
  if (!shell) return;
  shell.classList.toggle('guest', Boolean(isGuest));
}

function showAuthScreen() {
  const auth = document.getElementById('auth-screen');
  setGuestMode(true);
  updateCurrentUserDisplay();
  if (auth) auth.classList.remove('hidden');
  const usernameInput = document.getElementById('login-username');
  if (usernameInput) {
    window.requestAnimationFrame(() => usernameInput.focus());
  }
}

function showAppShell() {
  const auth = document.getElementById('auth-screen');
  setGuestMode(false);
  if (auth) auth.classList.add('hidden');
}

function bindAuthForm() {
  const form = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');

  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', event => {
      event.preventDefault();
      void attemptLogin();
    });
  }

  const sessionLabel = document.getElementById('current-user-label');
  if (sessionLabel && !sessionLabel.dataset.bound) {
    sessionLabel.dataset.bound = 'true';
    sessionLabel.addEventListener('click', event => {
      event.preventDefault();
      if (!currentUserId) showAuthScreen();
    });
  }

  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', () => logoutCurrentUser());
  }
}

function setCodesAccessError(message) {
  const el = document.getElementById('codes-access-error');
  if (el) el.textContent = message || '';
}

function bindCodesUi() {
  const codesBtn = document.getElementById('codes-btn');
  const input = document.getElementById('codes-access-input');

  if (codesBtn && !codesBtn.dataset.bound) {
    codesBtn.dataset.bound = 'true';
    codesBtn.addEventListener('click', () => handleCodesButton());
  }

  if (input && !input.dataset.bound) {
    input.dataset.bound = 'true';
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submitCodesAccess();
      }
    });
  }
}

function bindValidationRunUi() {
  const button = document.getElementById('validation-run-btn');

  if (button && !button.dataset.bound) {
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      if (!currentUserId) {
        showAuthScreen();
        return;
      }
      if (!codesAccessGranted) {
        openCodesAccessModal();
        return;
      }
      void runValidationSheetCheck();
    });
  }

  renderValidationRunState();
}

function openCodesAccessModal() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  setCodesAccessError('');
  const modal = document.getElementById('codes-access-modal');
  const input = document.getElementById('codes-access-input');
  if (input) {
    input.value = '';
    window.requestAnimationFrame(() => input.focus());
  }
  if (modal) modal.classList.add('open');
}

function closeCodesAccessModal() {
  setCodesAccessError('');
  const modal = document.getElementById('codes-access-modal');
  const input = document.getElementById('codes-access-input');
  if (input) input.value = '';
  if (modal) modal.classList.remove('open');
}

function handleCodesButton() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  if (codesAccessGranted) {
    currentView = 'codigos';
    saveUiPrefs();
    renderAll();
    return;
  }

  openCodesAccessModal();
}

async function submitCodesAccess() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  const input = document.getElementById('codes-access-input');
  const code = normalizeCredential(input?.value);

  if (!code) {
    setCodesAccessError('Ingresá la clave.');
    return;
  }

  if (code !== normalizeCredential(CODES_ACCESS_CODE)) {
    setCodesAccessError('Clave incorrecta.');
    return;
  }

  codesAccessGranted = true;
  saveCodesAccess(true);
  closeCodesAccessModal();
  currentView = 'codigos';
  saveUiPrefs();
  secretCodesLoaded = false;
  renderAll();
}

function setLoginError(message) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = message || '';
}

async function attemptLogin() {
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const username = normalizeCredential(usernameInput?.value);
  const password = normalizeCredential(passwordInput?.value);

  setLoginError('');

  if (!username || !password) {
    setLoginError('Completá usuario y contraseña.');
    return;
  }

  const user = APP.usuarios.find(candidate => {
    const candidateUsername = normalizeCredential(candidate.login_name || candidate.name);
    const candidatePassword = normalizeCredential(candidate.login_password || candidate.login_name || candidate.name);
    return candidateUsername === username && candidatePassword === password;
  });
  if (!user) {
    setLoginError('Usuario o contraseña incorrectos.');
    return;
  }

  currentUserId = Number(user.id);
  saveAuthSession(currentUserId);
  currentView = 'mi-album';
  currentFilter = 'all';
  saveUiPrefs();
  setLoginError('');
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  showAppShell();
  try {
    await reloadFromSource();
  } catch (error) {
    console.error(error);
    renderAll();
  }
}

function logoutCurrentUser() {
  currentUserId = null;
  clearAuthSession();
  clearCodesAccess();
  resetValidationRunState();
  setLoginError('');
  setCodesAccessError('');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  currentView = 'mi-album';
  codesAccessGranted = false;
  secretCodesRows = [];
  secretCodesLoaded = false;
  setGuestMode(true);
  closeCodesAccessModal();
  saveUiPrefs();
  updateCurrentUserDisplay();
  showAuthScreen();
  updateBadges();
}

function updateVisibleView() {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${currentView}`);
  });
}

function persistAndRender() {
  saveUiPrefs();
  updateCurrentUserDisplay();
  populateMessagePartnerSelect();
  populateCommentFiguritaSelect();
  renderCurrentView();
  updateBadges();
}

function renderCurrentView() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  if (currentView === 'intercambios' || (currentView === 'codigos' && !codesAccessGranted)) {
    currentView = 'mi-album';
    saveUiPrefs();
  }
  updateVisibleView();
  updateNavActive();
  updateCodesButtonState();

  switch (currentView) {
    case 'mi-album':
      renderMyAlbum();
      break;
    case 'todos':
      renderAlbum();
      break;
    case 'intercambios':
      renderTrades();
      break;
    case 'mensajes':
      renderMessages();
      break;
    case 'ranking':
      renderRanking();
      break;
    case 'codigos':
      renderCodesView();
      break;
    default:
      renderMyAlbum();
      break;
  }
}

function renderAll() {
  if (!currentUserId) {
    updateCurrentUserDisplay();
    setGuestMode(true);
    showAuthScreen();
    return;
  }
  updateCurrentUserDisplay();
  setGuestMode(false);
  populateMessagePartnerSelect();
  populateCommentFiguritaSelect();
  showAppShell();
  renderCurrentView();
  updateBadges();
}

function switchView(viewName) {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  if (viewName === 'intercambios') {
    viewName = 'mi-album';
  }
  if (viewName === 'codigos' && !codesAccessGranted) {
    openCodesAccessModal();
    return;
  }
  currentView = viewName;
  if (viewName === 'mensajes') {
    void markMessagesAsRead(currentUserId).catch(error => console.error(error));
  }
  if (viewName === 'codigos') {
    secretCodesLoaded = false;
  }
  saveUiPrefs();
  renderCurrentView();
  updateBadges();
}

function setFilter(filter, btn) {
  currentFilter = filter;
  saveUiPrefs();
  document.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMyAlbum();
}

function renderMyAlbum() {
  const owned = getOwnedMap(currentUserId);
  const total = APP.stickers.length || 1;
  const ownedCount = countDistinctOwned(owned);
  const duplicateCount = countDuplicateTypes(owned);
  const missingCount = total - ownedCount;

  const stats = document.getElementById('stats-bar');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon gold">⭐</div>
        <div class="stat-info">
          <div class="stat-val">${ownedCount}</div>
          <div class="stat-label">Tengo</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">🔄</div>
        <div class="stat-info">
          <div class="stat-val">${duplicateCount}</div>
          <div class="stat-label">Repetidas</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">❓</div>
        <div class="stat-info">
          <div class="stat-val">${missingCount}</div>
          <div class="stat-label">Me faltan</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">📊</div>
        <div class="stat-info">
          <div class="stat-val">${Math.round((ownedCount / total) * 100)}%</div>
          <div class="stat-label">Completo</div>
        </div>
      </div>
    `;
  }

  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');
  if (progressText) progressText.textContent = `${ownedCount} / ${APP.stickers.length}`;
  if (progressFill) progressFill.style.width = `${(ownedCount / total) * 100}%`;

  renderStickerGrid('my-sticker-grid', currentFilter, currentUserId);
}

function renderStickerGrid(containerId, filter, userId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const owned = getOwnedMap(userId);
  let filtered = APP.stickers;

  if (filter === 'owned') filtered = APP.stickers.filter(sticker => (owned[sticker.id] || 0) >= 1);
  if (filter === 'duplicate') filtered = APP.stickers.filter(sticker => (owned[sticker.id] || 0) >= 2);
  if (filter === 'missing') filtered = APP.stickers.filter(sticker => (owned[sticker.id] || 0) === 0);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="big">🗂️</div><p>No hay figuritas en esta categoría</p></div>';
    return;
  }

  container.innerHTML = filtered.map(sticker => stickerHTML(sticker, owned[sticker.id] || 0)).join('');
}

function stickerHTML(sticker, qty) {
  const stateClass = qty === 0
    ? 'missing'
    : qty === 1
      ? 'owned'
      : 'duplicate owned';
  const badgeHTML = qty === 0
    ? '<div class="sticker-badge missing-badge">Falta</div>'
    : qty === 1
      ? '<div class="sticker-badge">✓</div>'
      : `<div class="sticker-badge dup">x${qty}</div>`;
  const bg = BG_COLORS[(sticker.id - 1) % BG_COLORS.length];
  const imagePath = resolveStickerImagePath(sticker);
  const imageHTML = imagePath && qty > 0
      ? `<img class="sticker-image" src="${escapeAttr(imagePath)}" alt="${escapeAttr(sticker.name)}">`
      : `<div class="sticker-avatar" style="background:${bg}; color:rgba(255,255,255,0.9);">${escapeHtml(sticker.initials)}</div>`;
  const title = 'Click para activar con código secreto';

  return `
    <div class="sticker-card ${stateClass}" onclick="toggleOwn(${sticker.id})" title="${escapeAttr(title)}">
      <div class="sticker-photo">
        ${imageHTML}
        <div class="sticker-number">#${String(sticker.id).padStart(2, '0')}</div>
        ${badgeHTML}
      </div>
      <div class="sticker-info">
        <div class="sticker-name">${escapeHtml(sticker.name)}</div>
      </div>
    </div>
  `;
}

function toggleOwn(stickerId) {
  openStickerCodeModal(stickerId);
}

function setStickerCodeError(message) {
  const el = document.getElementById('sticker-code-error');
  if (el) el.textContent = message || '';
}

function openStickerCodeModal(stickerId) {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  pendingStickerId = Number(stickerId);
  setStickerCodeError('');

  const sticker = getStickerById(stickerId);
  const modal = document.getElementById('code-modal');
  const target = document.getElementById('code-modal-target');
  const input = document.getElementById('sticker-code-input');

  if (target) {
    const bg = BG_COLORS[(Number(stickerId) - 1) % BG_COLORS.length];
    target.innerHTML = `
      <div class="code-target-emoji" style="background:${bg}; color:rgba(255,255,255,0.95);">${escapeHtml(sticker?.initials || '🔒')}</div>
      <div class="code-target-info">
        <div class="code-target-name">#${String(stickerId).padStart(2, '0')} ${escapeHtml(sticker?.name || 'Figurita')}</div>
        <div class="code-target-meta">Se agregará directamente a tu álbum</div>
      </div>
    `;
  }

  if (input) {
    input.value = '';
    window.requestAnimationFrame(() => input.focus());
  }

  if (modal) modal.classList.add('open');
}

function closeStickerCodeModal() {
  pendingStickerId = null;
  setStickerCodeError('');
  const modal = document.getElementById('code-modal');
  const input = document.getElementById('sticker-code-input');
  if (input) input.value = '';
  if (modal) modal.classList.remove('open');
}

function demoActivateStickerWithCode(userId, stickerId, code) {
  const sticker = getStickerById(stickerId);
  if (!sticker) {
    throw new Error('figurita no encontrada');
  }

  if (normalizeStickerCode(sticker.secret_code) !== normalizeStickerCode(code)) {
    throw new Error('codigo incorrecto');
  }

  setLocalStickerQty(userId, stickerId, getLocalQty(userId, stickerId) + 1);
  const rawSticker = APP.figuritas.find(item => Number(item.id) === Number(stickerId));
  if (rawSticker) rawSticker.foto_path = resolveStickerImagePath(sticker || rawSticker);
  return 'accepted';
}

async function submitStickerCode() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  if (!pendingStickerId) {
    closeStickerCodeModal();
    return;
  }

  const input = document.getElementById('sticker-code-input');
  const code = normalizeStickerCode(input?.value);
  if (!code) {
    setStickerCodeError('Ingresá el código secreto.');
    return;
  }

  try {
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('activar_figurita_con_codigo', {
        p_user_id: currentUserId,
        p_figurita_id: pendingStickerId,
        p_codigo: code,
      });
      if (error) throw error;
      secretCodesRows = [];
      secretCodesLoaded = false;
      pendingValidationLoaded = false;
      await reloadFromSource();
    } else {
      demoActivateStickerWithCode(currentUserId, pendingStickerId, code);
      secretCodesRows = [];
      secretCodesLoaded = false;
      pendingValidationLoaded = false;
      rebuildDerivedData();
      renderAll();
    }
    closeStickerCodeModal();
    showToast('✅ Figurita agregada al álbum');
  } catch (error) {
    console.error(error);
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('codigo incorrecto')) {
      setStickerCodeError('Código incorrecto.');
    } else if (msg.includes('figurita no encontrada')) {
      setStickerCodeError('Figurita no encontrada.');
    } else {
      setStickerCodeError('No se pudo activar la figurita.');
    }
  }
}

function renderAlbum() {
  renderStickerGrid('album-grid', 'all', currentUserId);
}

function renderTrades() {
  const incoming = APP.intercambios.filter(trade => trade.to_user_id === currentUserId && trade.status === 'pending');
  const outgoing = APP.intercambios.filter(trade => trade.from_user_id === currentUserId);

  const incomingEl = document.getElementById('incoming-trades');
  if (incomingEl) {
    incomingEl.innerHTML = incoming.length === 0
      ? '<div class="empty-state" style="padding:40px 0;"><div class="big" style="font-size:40px;">📭</div><p>No tienes solicitudes pendientes</p></div>'
      : incoming.map(trade => tradeCardHTML(trade, true)).join('');
  }

  const outgoingEl = document.getElementById('outgoing-trades');
  if (outgoingEl) {
    outgoingEl.innerHTML = outgoing.length === 0
      ? '<div class="empty-state" style="padding:30px 0;"><div class="big" style="font-size:36px;">📤</div><p>Aún no has propuesto intercambios</p></div>'
      : outgoing.map(trade => tradeCardHTML(trade, false)).join('');
  }
}

function tradeCardHTML(trade, isIncoming) {
  const fromUser = getUserById(trade.from_user_id);
  const toUser = getUserById(trade.to_user_id);
  const statusMap = { pending: 'Pendiente', accepted: 'Aceptado', rejected: 'Rechazado', cancelled: 'Cancelado' };
  const statusClass = { pending: 'status-pending', accepted: 'status-accepted', rejected: 'status-rejected', cancelled: 'status-rejected' };

  const offerStickers = (trade.offer || []).map(id => miniStickerHTML(getStickerById(id))).join('');
  const requestStickers = (trade.request || []).map(id => miniStickerHTML(getStickerById(id))).join('');

  const actions = isIncoming && trade.status === 'pending'
    ? `
      <div class="trade-actions">
        <button class="btn btn-accept" onclick="respondTrade(${trade.id}, 'accepted')">✓ Aceptar</button>
        <button class="btn btn-reject" onclick="respondTrade(${trade.id}, 'rejected')">✗ Rechazar</button>
      </div>
    `
    : '';

  const createdAt = formatDateTime(trade.created_at || trade.time || '');
  const msg = trade.msg ? `<div style="font-size:12px; color:rgba(255,255,255,0.5); font-style:italic; margin-bottom:10px; padding:6px 10px; background:rgba(255,255,255,0.04); border-radius:6px;">"${escapeHtml(trade.msg)}"</div>` : '';

  return `
    <div class="trade-request">
      <div class="trade-parties">
        <div>
          <div class="trade-user">${escapeHtml(fromUser?.name || 'Usuario')}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">ofrece →</div>
        </div>
        <div class="trade-arrow" style="flex:1; text-align:center;">⇄</div>
        <div style="text-align:right;">
          <div class="trade-user">${escapeHtml(toUser?.name || 'Usuario')}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.4);">← pide</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
        <div>
          <div style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Da</div>
          <div class="trade-stickers">${offerStickers}</div>
        </div>
        <div>
          <div style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Recibe</div>
          <div class="trade-stickers">${requestStickers}</div>
        </div>
      </div>
      ${msg}
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span class="trade-status ${statusClass[trade.status] || ''}">${statusMap[trade.status] || trade.status}</span>
        <span style="font-size:11px; color:rgba(255,255,255,0.25);">${createdAt}</span>
      </div>
      ${actions}
    </div>
  `;
}

function miniStickerHTML(sticker) {
  if (!sticker) return '<div class="mini-sticker">Figurita desconocida</div>';
  return `<div class="mini-sticker"><span class="num">#${String(sticker.id).padStart(2, '0')}</span> ${escapeHtml(sticker.name.split(' ')[0])}</div>`;
}

async function respondTrade(tradeId, response) {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  try {
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('responder_intercambio', {
        p_intercambio_id: tradeId,
        p_status: response,
      });
      if (error) throw error;
      await reloadFromSource();
    } else {
      demoRespondTrade(tradeId, response);
      rebuildDerivedData();
      renderAll();
    }

    if (response === 'accepted') {
      showToast('🎉 ¡Intercambio completado! Las figuritas cambiaron de dueño');
    } else {
      showToast('❌ Intercambio rechazado');
    }
  } catch (error) {
    console.error(error);
    showToast('No se pudo responder el intercambio');
  }
}

function openModal() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  selectedOffer = new Set();
  selectedRequest = new Set();

  const sel = document.getElementById('trade-partner');
  if (sel) {
    sel.innerHTML = '<option value="">Selecciona una persona...</option>';
    APP.usuarios
      .filter(user => user.id !== currentUserId)
      .forEach(user => {
        const option = document.createElement('option');
        option.value = String(user.id);
        option.textContent = user.name;
        sel.appendChild(option);
      });
    sel.onchange = () => {
      selectedRequest = new Set();
      void refreshPickGrids();
    };
  }

  const msgInput = document.getElementById('trade-msg');
  if (msgInput) msgInput.value = '';
  void refreshPickGrids();
  document.getElementById('trade-modal').classList.add('open');
}

function renderPickGrid(containerId, stickers, selected, type, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (stickers.length === 0) {
    const message = emptyMessage || (type === 'offer' ? 'No tienes repetidas aún' : 'Selecciona un compañero primero');
    container.innerHTML = `<div style="color:rgba(255,255,255,0.3); font-size:13px; padding:16px; grid-column:1/-1; text-align:center;">${message}</div>`;
    return;
  }

  container.innerHTML = stickers.map(sticker => `
    <div class="pick-item ${selected.has(sticker.id) ? 'selected-pick' : ''}" onclick="togglePick(${sticker.id}, '${type}')">
      <div class="pick-num">#${String(sticker.id).padStart(2, '0')}</div>
      <div class="pick-name">${escapeHtml(sticker.name.split(' ')[0])}</div>
    </div>
  `).join('');
}

function getTradeOfferIds(trade) {
  if (Array.isArray(trade?.offer)) {
    return trade.offer.map(Number).filter(Number.isFinite);
  }

  const sides = APP.tradeItemsByTrade.get(Number(trade?.id));
  return (sides?.offer || []).map(Number).filter(Number.isFinite);
}

function getPendingOfferedStickerIds(userId) {
  const numericUserId = Number(userId);
  const ids = new Set();
  if (!Number.isFinite(numericUserId)) return ids;

  APP.intercambios.forEach(trade => {
    if (Number(trade.from_user_id) !== numericUserId || trade.status !== 'pending') return;
    getTradeOfferIds(trade).forEach(figuritaId => ids.add(figuritaId));
  });

  return ids;
}

async function loadPendingOfferedStickerIds(userId) {
  const localIds = getPendingOfferedStickerIds(userId);
  if (!usingRemoteDb()) return localIds;

  try {
    const { data: trades, error: tradesError } = await supabaseClient
      .from('intercambios')
      .select('id')
      .eq('from_user_id', Number(userId))
      .eq('status', 'pending');
    if (tradesError) throw tradesError;

    const tradeIds = (trades || []).map(trade => Number(trade.id)).filter(Number.isFinite);
    if (tradeIds.length === 0) return new Set();

    const { data: items, error: itemsError } = await supabaseClient
      .from('intercambio_items')
      .select('figurita_id')
      .in('intercambio_id', tradeIds)
      .eq('side', 'offer');
    if (itemsError) throw itemsError;

    return new Set((items || []).map(item => Number(item.figurita_id)).filter(Number.isFinite));
  } catch (error) {
    console.warn('No se pudieron cargar las figuritas comprometidas; se usa el estado local.', error);
    return localIds;
  }
}

function getBlockedOfferIds(offerIds, pendingOfferIds) {
  return [...new Set((offerIds || []).map(Number).filter(Number.isFinite))]
    .filter(figuritaId => pendingOfferIds.has(figuritaId));
}

function removeBlockedOffersFromSelection(blockedIds) {
  const blocked = new Set(blockedIds.map(Number));
  selectedOffer = new Set([...selectedOffer].filter(figuritaId => !blocked.has(Number(figuritaId))));
}

function pendingOfferToast(blockedIds) {
  const names = blockedIds
    .map(figuritaId => getStickerById(figuritaId))
    .filter(Boolean)
    .map(sticker => `#${String(sticker.id).padStart(2, '0')} ${sticker.name}`);
  const suffix = names.length ? `: ${names.join(', ')}` : '';
  return `⚠️ Ya tienes esa lámina en un intercambio pendiente${suffix}`;
}

function assertNoPendingOfferConflict(userId, offerIds) {
  const blockedIds = getBlockedOfferIds(offerIds, getPendingOfferedStickerIds(userId));
  if (blockedIds.length > 0) {
    throw new Error('figurita ya comprometida en intercambio pendiente');
  }
}

async function loadTradePartnerOwnedMap(userId) {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) return {};

  const cached = APP.tradeOwnedByUser.get(numericUserId);
  if (cached) return cached;

  const rows = await fetchUserFiguritasRows(numericUserId);
  const owned = {};
  rows.forEach(row => {
    const figuritaId = Number(row.figurita_id);
    const cantidad = Number(row.cantidad) || 0;
    if (cantidad > 0) owned[figuritaId] = cantidad;
  });

  APP.tradeOwnedByUser.set(numericUserId, owned);
  return owned;
}

async function refreshPickGrids() {
  const token = ++tradePickLoadToken;
  const partnerId = Number(document.getElementById('trade-partner').value || 0);
  const myOwned = getOwnedMap(currentUserId);
  const pendingOfferIds = await loadPendingOfferedStickerIds(currentUserId);
  if (token !== tradePickLoadToken) return;

  const myDupes = APP.stickers.filter(sticker => (myOwned[sticker.id] || 0) >= 2);
  removeBlockedOffersFromSelection(getBlockedOfferIds([...selectedOffer], pendingOfferIds));
  const availableDupes = myDupes.filter(sticker => !pendingOfferIds.has(sticker.id));
  const offerEmptyMessage = myDupes.length > 0
    ? 'Tus repetidas están comprometidas en intercambios pendientes'
    : 'No tienes repetidas aún';
  renderPickGrid('offer-grid', availableDupes, selectedOffer, 'offer', offerEmptyMessage);

  const requestGrid = document.getElementById('request-grid');
  if (requestGrid) {
    requestGrid.innerHTML = partnerId
      ? '<div style="color:rgba(255,255,255,0.3); font-size:13px; padding:16px; grid-column:1/-1; text-align:center;">Cargando repetidas...</div>'
      : '<div style="color:rgba(255,255,255,0.3); font-size:13px; padding:16px; grid-column:1/-1; text-align:center;">Selecciona un compañero primero</div>';
  }

  if (!partnerId) return;

  try {
    const partnerOwned = await loadTradePartnerOwnedMap(partnerId);
    if (token !== tradePickLoadToken) return;

    const partnerDupesIMissing = APP.stickers.filter(sticker =>
      (partnerOwned[sticker.id] || 0) >= 2 && (myOwned[sticker.id] || 0) === 0
    );
    renderPickGrid('request-grid', partnerDupesIMissing, selectedRequest, 'request');
  } catch (error) {
    if (token !== tradePickLoadToken) return;
    console.error(error);
    if (requestGrid) {
      requestGrid.innerHTML = '<div style="color:rgba(255,255,255,0.3); font-size:13px; padding:16px; grid-column:1/-1; text-align:center;">No se pudieron cargar las repetidas</div>';
    }
  }
}

function togglePick(id, type) {
  const set = type === 'offer' ? selectedOffer : selectedRequest;
  if (set.has(id)) set.delete(id);
  else set.add(id);
  void refreshPickGrids();
}

async function submitTrade() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  const partnerId = Number(document.getElementById('trade-partner').value || 0);
  if (!partnerId) return showToast('⚠️ Selecciona un compañero');
  if (selectedOffer.size === 0) return showToast('⚠️ Selecciona qué figuritas ofreces');
  if (selectedRequest.size === 0) return showToast('⚠️ Selecciona qué figuritas pides');

  const pendingOfferIds = await loadPendingOfferedStickerIds(currentUserId);
  const blockedOfferIds = getBlockedOfferIds([...selectedOffer], pendingOfferIds);
  if (blockedOfferIds.length > 0) {
    removeBlockedOffersFromSelection(blockedOfferIds);
    if (usingRemoteDb()) await reloadFromSource(false);
    await refreshPickGrids();
    return showToast(pendingOfferToast(blockedOfferIds));
  }

  const msg = document.getElementById('trade-msg').value.trim();
  try {
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('crear_intercambio', {
        p_from_user_id: currentUserId,
        p_to_user_id: partnerId,
        p_msg: msg || null,
        p_offer_ids: [...selectedOffer],
        p_request_ids: [...selectedRequest],
      });
      if (error) throw error;
      await reloadFromSource();
    } else {
      demoCreateTrade(currentUserId, partnerId, msg, [...selectedOffer], [...selectedRequest]);
      rebuildDerivedData();
      renderAll();
    }

    closeModal();
    const partner = getUserById(partnerId);
    showToast(`✅ Propuesta enviada a ${partner?.name || 'tu compañero'}!`);
  } catch (error) {
    console.error(error);
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('figurita ya comprometida en intercambio pendiente')) {
      await reloadFromSource(false);
      await refreshPickGrids();
      showToast('⚠️ Una de tus láminas ya está comprometida en un intercambio pendiente');
    } else {
      showToast('No se pudo enviar la propuesta');
    }
  }
}

function closeModal() {
  document.getElementById('trade-modal').classList.remove('open');
}

function renderMessages() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  populateMessagePartnerSelect();
  populateCommentFiguritaSelect();

  const directMessages = APP.mensajes
    .filter(message => message.from_user_id === currentUserId || message.to_user_id === currentUserId)
    .sort(sortByCreatedAtDesc);

  const messagesList = document.getElementById('messages-list');
  if (messagesList) {
    if (directMessages.length === 0) {
      messagesList.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="big" style="font-size:40px;">💬</div><p>No tienes mensajes directos todavía</p></div>';
    } else {
      messagesList.innerHTML = directMessages.map(message => messageCardHTML(message)).join('');
    }
  }

  const comments = APP.comentarios
    .filter(comment => comment.figurita_id != null)
    .sort(sortByCreatedAtDesc)
    .slice(0, 30);

  const commentsList = document.getElementById('comments-list');
  if (commentsList) {
    if (comments.length === 0) {
      commentsList.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="big" style="font-size:40px;">📝</div><p>No hay comentarios todavía</p></div>';
    } else {
      commentsList.innerHTML = comments.map(comment => commentCardHTML(comment)).join('');
    }
  }
}

function messageCardHTML(message) {
  const fromUser = getUserById(message.from_user_id);
  const toUser = message.to_user_id ? getUserById(message.to_user_id) : null;
  const isMine = message.from_user_id === currentUserId;
  const statusTag = isMine ? 'Enviado' : (message.is_read ? 'Leído' : 'Nuevo');

  return `
    <div class="message-card" style="${isMine ? 'border-color:rgba(245,200,66,0.25);' : ''}">
      <div class="message-head">
        <div class="message-user">${escapeHtml(fromUser?.name || 'Usuario')} → ${escapeHtml(toUser?.name || 'Todos')}</div>
        <div class="message-meta">${statusTag} · ${formatDateTime(message.created_at)}</div>
      </div>
      <div class="message-body">${escapeHtml(message.body)}</div>
    </div>
  `;
}

function commentCardHTML(comment) {
  const user = getUserById(comment.user_id);
  const sticker = comment.figurita_id ? getStickerById(comment.figurita_id) : null;
  const target = sticker ? `#${String(sticker.id).padStart(2, '0')} ${sticker.name}` : 'Objetivo';

  return `
    <div class="comment-card">
      <div class="comment-head">
        <div class="comment-user">${escapeHtml(user?.name || 'Usuario')} <span style="color:rgba(255,255,255,0.4); font-weight:600;">en ${escapeHtml(target)}</span></div>
        <div class="comment-meta">${formatDateTime(comment.created_at)}</div>
      </div>
      <div class="comment-body">${escapeHtml(comment.body)}</div>
    </div>
  `;
}

async function sendMessage() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  const partnerId = Number(document.getElementById('message-partner').value || 0);
  const bodyEl = document.getElementById('message-body');
  const body = bodyEl.value.trim();

  if (!partnerId) return showToast('⚠️ Selecciona un destinatario');
  if (!body) return showToast('⚠️ Escribe un mensaje');

  try {
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('crear_mensaje', {
        p_from_user_id: currentUserId,
        p_to_user_id: partnerId,
        p_body: body,
      });
      if (error) throw error;
      await reloadFromSource();
    } else {
      demoCreateMessage(currentUserId, partnerId, body);
      rebuildDerivedData();
      renderAll();
    }

    bodyEl.value = '';
    showToast('✅ Mensaje enviado');
  } catch (error) {
    console.error(error);
    showToast('No se pudo enviar el mensaje');
  }
}

async function addComment() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }
  const figuritaId = Number(document.getElementById('comment-figurita').value || 0);
  const bodyEl = document.getElementById('comment-body');
  const body = bodyEl.value.trim();

  if (!figuritaId) return showToast('⚠️ Selecciona una figurita');
  if (!body) return showToast('⚠️ Escribe un comentario');

  try {
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('crear_comentario', {
        p_user_id: currentUserId,
        p_figurita_id: figuritaId,
        p_body: body,
      });
      if (error) throw error;
      await reloadFromSource();
    } else {
      demoCreateComment(currentUserId, figuritaId, body);
      rebuildDerivedData();
      renderAll();
    }

    bodyEl.value = '';
    showToast('✅ Comentario publicado');
  } catch (error) {
    console.error(error);
    showToast('No se pudo publicar el comentario');
  }
}

function renderRanking() {
  const scores = APP.usuarios.map(user => {
    const count = getOwnedCountForRanking(user.id);
    const pct = APP.stickers.length ? Math.round((count / APP.stickers.length) * 100) : 0;
    return {
      ...user,
      initials: initialsFromName(user.name),
      count,
      pct,
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const max = scores[0]?.count || 1;
  const container = document.getElementById('ranking-list');
  if (!container) return;

  container.innerHTML = scores.map((score, index) => {
    const numClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
    const bg = BG_COLORS[(score.id - 1) % BG_COLORS.length];
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
    return `
      <div class="rank-row">
        <div class="rank-num ${numClass}">${index + 1}</div>
        <div class="rank-avatar" style="background:${bg}; color:rgba(255,255,255,0.9); font-size:14px;">${escapeHtml(score.initials)}</div>
        <div class="rank-info">
          <div class="rank-name">${escapeHtml(score.name)} ${medal}</div>
        </div>
        <div class="rank-bar-wrap">
          <div class="rank-bar">
            <div class="rank-fill" style="width:${(score.count / max) * 100}%"></div>
          </div>
          <div class="rank-pct">${score.pct}% del álbum</div>
        </div>
        <div class="rank-count">${score.count}<span style="font-size:13px; color:rgba(255,255,255,0.3); font-family:'Nunito',sans-serif; font-weight:400;">/${APP.stickers.length}</span></div>
      </div>
    `;
  }).join('');
}

function renderCodesTableRows() {
  const body = document.getElementById('codes-table-body');
  if (!body) return;

  if (!codesAccessGranted) {
    body.innerHTML = '<tr><td colspan="2"><div class="codes-empty">Vista bloqueada.</div></td></tr>';
    return;
  }

  if (!secretCodesRows.length) {
    body.innerHTML = '<tr><td colspan="2"><div class="codes-empty">No hay códigos para mostrar.</div></td></tr>';
    return;
  }

  body.innerHTML = secretCodesRows.map(row => `
    <tr>
      <td class="codes-name">${escapeHtml(row.nombre || '')}</td>
      <td class="codes-secret">${escapeHtml(row.secret_code || '')}</td>
    </tr>
  `).join('');
}

async function loadCodesRows() {
  if (!currentUserId || !codesAccessGranted) return [];

  if (usingRemoteDb()) {
    // Prefer the corrected view name, but keep the legacy typo as a fallback.
    const remoteViews = ['codigos_secretos', 'codigos_sectretos'];
    let lastError = null;

    for (const viewName of remoteViews) {
      const { data, error } = await supabaseClient
        .from(viewName)
        .select('figurita_id,nombre,secret_code')
        .order('figurita_id', { ascending: true });

      if (!error) {
        return (data || []).map(row => ({
          figurita_id: Number(row.figurita_id),
          nombre: row.nombre || '',
          secret_code: row.secret_code || '',
        }));
      }

      lastError = error;
      if (error.code !== 'PGRST205') break;
    }

    throw lastError;
  }

  return APP.figuritas.map(figurita => {
    const user = APP.usuariosById.get(Number(figurita.user_id));
    return {
      figurita_id: Number(figurita.id),
      nombre: user?.name || `Usuario ${figurita.user_id}`,
      secret_code: figurita.secret_code || '',
    };
  }).sort((a, b) => Number(a.figurita_id) - Number(b.figurita_id));
}

async function refreshCodesRows() {
  const body = document.getElementById('codes-table-body');
  if (!body) return;

  if (!codesAccessGranted) {
    renderCodesTableRows();
    return;
  }

  if (secretCodesLoading) return;

  secretCodesLoading = true;
  body.innerHTML = '<tr><td colspan="2"><div class="codes-empty">Cargando códigos...</div></td></tr>';

  try {
    secretCodesRows = await loadCodesRows();
    secretCodesLoaded = true;
    renderCodesTableRows();
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="2"><div class="codes-empty">No se pudieron cargar los códigos.</div></td></tr>';
  } finally {
    secretCodesLoading = false;
  }
}

function renderPendingValidationsRows() {
  const body = document.getElementById('pending-validations-table-body');
  if (!body) return;

  if (!codesAccessGranted) {
    body.innerHTML = '<tr><td colspan="4"><div class="codes-empty">Vista bloqueada.</div></td></tr>';
    return;
  }

  if (!pendingValidationRows.length) {
    body.innerHTML = '<tr><td colspan="4"><div class="codes-empty">No hay solicitudes pendientes.</div></td></tr>';
    return;
  }

  body.innerHTML = pendingValidationRows.map(row => {
    const user = getUserById(row.user_id);
    const sticker = getStickerById(row.figurita_id);
    const createdAt = formatDateTime(row.created_at);
    return `
      <tr>
        <td class="codes-name">${escapeHtml(user?.name || `Usuario ${row.user_id}`)}</td>
        <td class="codes-name">${escapeHtml(sticker?.name || `Figurita ${row.figurita_id}`)}</td>
        <td class="codes-secret">${escapeHtml(createdAt)}</td>
        <td class="codes-actions">
          <button class="btn btn-accept btn-small" onclick="approvePendingValidation(${row.id})">Aprobar</button>
          <button class="btn btn-reject btn-small" onclick="rejectPendingValidation(${row.id})">Rechazar</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderValidationRunState() {
  const status = document.getElementById('validation-run-status');
  const button = document.getElementById('validation-run-btn');

  if (button) {
    button.disabled = validationRunLoading;
  }

  if (status) {
    status.textContent = validationRunLoading ? 'Corriendo...' : validationRunStatus;
  }
}

async function loadPendingValidationRows() {
  if (!currentUserId || !codesAccessGranted) return [];

  if (usingRemoteDb()) {
    const { data, error } = await supabaseClient.rpc('listar_validaciones_secretas_pendientes');
    if (error) throw error;
    return (data || []).map(row => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      figurita_id: Number(row.figurita_id),
      status: row.status || 'pending',
      created_at: row.created_at || new Date().toISOString(),
      responded_at: row.responded_at || null,
      responded_by_user_id: row.responded_by_user_id == null ? null : Number(row.responded_by_user_id),
    }));
  }

  return APP.validacionesSecretas
    .filter(row => row.status === 'pending')
    .map(row => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      figurita_id: Number(row.figurita_id),
      status: row.status || 'pending',
      created_at: row.created_at || new Date().toISOString(),
      responded_at: row.responded_at || null,
      responded_by_user_id: row.responded_by_user_id == null ? null : Number(row.responded_by_user_id),
    }))
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

async function refreshPendingValidationRows() {
  const body = document.getElementById('pending-validations-table-body');
  if (!body) return;

  if (!codesAccessGranted) {
    renderPendingValidationsRows();
    return;
  }

  if (pendingValidationLoading) return;

  pendingValidationLoading = true;
  body.innerHTML = '<tr><td colspan="4"><div class="codes-empty">Cargando solicitudes...</div></td></tr>';

  try {
    pendingValidationRows = await loadPendingValidationRows();
    pendingValidationLoaded = true;
    renderPendingValidationsRows();
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="4"><div class="codes-empty">No se pudieron cargar las solicitudes.</div></td></tr>';
  } finally {
    pendingValidationLoading = false;
  }
}

function makeValidationUsageKey(userId, figuritaId) {
  return `${Number(userId)}|${Number(figuritaId)}`;
}

function addValidationUsageCount(counts, userId, figuritaId, qty = 1) {
  const numericUserId = Number(userId);
  const numericFiguritaId = Number(figuritaId);
  const numericQty = Number(qty) || 0;
  if (!Number.isFinite(numericUserId) || !Number.isFinite(numericFiguritaId) || numericQty <= 0) return;

  const key = makeValidationUsageKey(numericUserId, numericFiguritaId);
  counts.set(key, (counts.get(key) || 0) + numericQty);
}

function buildValidationUsageRows({ usuarioFiguritas, intercambios, intercambioItems }) {
  const counts = new Map();

  (usuarioFiguritas || []).forEach(row => {
    addValidationUsageCount(counts, row.user_id, row.figurita_id, row.cantidad);
  });

  const tradesById = new Map((intercambios || []).map(trade => [Number(trade.id), trade]));
  (intercambioItems || []).forEach(item => {
    const trade = tradesById.get(Number(item.intercambio_id));
    if (!trade || !['pending', 'accepted'].includes(trade.status)) return;

    let ownerUserId = null;
    if (item.side === 'offer') ownerUserId = trade.from_user_id;
    if (item.side === 'request') ownerUserId = trade.to_user_id;
    addValidationUsageCount(counts, ownerUserId, item.figurita_id, 1);
  });

  return [...counts.entries()].map(([key, cantidad]) => {
    const [userId, figuritaId] = key.split('|').map(Number);
    return {
      user_id: userId,
      figurita_id: figuritaId,
      cantidad,
    };
  });
}

async function loadValidationUsageRows() {
  if (usingRemoteDb()) {
    try {
      const { data, error } = await supabaseClient.rpc('listar_consumo_validacion_figuritas');
      if (error) throw error;
      return (data || []).map(row => ({
        user_id: Number(row.user_id),
        figurita_id: Number(row.figurita_id),
        cantidad: Number(row.cantidad) || 0,
      }));
    } catch (error) {
      console.warn('No se pudo cargar listar_consumo_validacion_figuritas; se intenta calcular desde tablas.', error);
    }

    const [usuarioFiguritas, intercambios, intercambioItems] = await Promise.all([
      fetchRemoteRows({ rpcName: 'listar_usuario_figuritas', table: 'usuario_figuritas', orderColumn: 'created_at' }),
      fetchRemoteRows({ table: 'intercambios', orderColumn: 'created_at', columns: 'id,from_user_id,to_user_id,status' }),
      fetchRemoteRows({ table: 'intercambio_items', orderColumn: 'id', columns: 'intercambio_id,figurita_id,side' }),
    ]);
    return buildValidationUsageRows({ usuarioFiguritas, intercambios, intercambioItems });
  }

  return buildValidationUsageRows({
    usuarioFiguritas: APP.usuarioFiguritas,
    intercambios: APP.intercambios,
    intercambioItems: APP.intercambioItems,
  });
}

async function loadValidationUsageCountMap() {
  const rows = await loadValidationUsageRows();
  const counts = new Map();
  rows.forEach(row => {
    addValidationUsageCount(counts, row.user_id, row.figurita_id, row.cantidad);
  });
  return counts;
}

function renderCodesView() {
  const codesBody = document.getElementById('codes-table-body');
  const pendingBody = document.getElementById('pending-validations-table-body');
  if (!codesBody && !pendingBody) return;

  if (!codesAccessGranted) {
    renderCodesTableRows();
    renderPendingValidationsRows();
    return;
  }

  if (!secretCodesLoaded) {
    void refreshCodesRows();
  } else {
    renderCodesTableRows();
  }

  if (!pendingValidationLoaded) {
    void refreshPendingValidationRows();
  } else {
    renderPendingValidationsRows();
  }

  renderValidationRunState();
}

async function processPendingValidationIds(validationIds, shouldApprove) {
  if (!currentUserId) {
    showAuthScreen();
    return { processedCount: 0, failedCount: validationIds?.length || 0 };
  }

  const ids = [...new Set((validationIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) {
    return { processedCount: 0, failedCount: 0 };
  }

  const rpcName = shouldApprove ? 'aprobar_validacion_secreta' : 'rechazar_validacion_secreta';
  let processedCount = 0;
  let failedCount = 0;
  const processedRows = [];

  if (usingRemoteDb()) {
    for (const validationId of ids) {
      try {
        const validation = pendingValidationRows.find(item => Number(item.id) === Number(validationId))
          || APP.validacionesSecretas.find(item => Number(item.id) === Number(validationId))
          || null;
        const { error } = await supabaseClient.rpc(rpcName, {
          p_validacion_id: validationId,
          p_approved_by_user_id: currentUserId,
        });
        if (error) throw error;
        processedCount += 1;
        if (validation) processedRows.push(validation);
      } catch (error) {
        console.error(error);
        failedCount += 1;
      }
    }

    pendingValidationLoaded = false;
    if (processedRows.length) {
      processedRows.forEach(validation => syncValidationDecisionLocally(validation, shouldApprove, currentUserId));
      rebuildDerivedData();
    }

    try {
      await reloadFromSource(false);
    } catch (reloadError) {
      console.error(reloadError);
      renderAll();
    }

    if (codesAccessGranted) {
      void refreshPendingValidationRows().catch(error => console.error(error));
    }
    return { processedCount, failedCount };
  }

  for (const validationId of ids) {
    try {
      if (shouldApprove) demoApproveValidation(validationId, currentUserId);
      else demoRejectValidation(validationId, currentUserId);
      processedCount += 1;
    } catch (error) {
      console.error(error);
      failedCount += 1;
    }
  }

  pendingValidationLoaded = false;
  rebuildDerivedData();
  renderAll();
  return { processedCount, failedCount };
}

async function approvePendingValidation(validationId) {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  try {
    const result = await processPendingValidationIds([validationId], true);
    if (result.processedCount > 0) {
      showToast('✅ Figurita aprobada');
    } else {
      showToast('No se pudo aprobar la solicitud');
    }
  } catch (error) {
    console.error(error);
    showToast('No se pudo aprobar la solicitud');
  }
}

async function rejectPendingValidation(validationId) {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  try {
    const result = await processPendingValidationIds([validationId], false);
    if (result.processedCount > 0) {
      showToast('❌ Solicitud rechazada');
    } else {
      showToast('No se pudo rechazar la solicitud');
    }
  } catch (error) {
    console.error(error);
    showToast('No se pudo rechazar la solicitud');
  }
}

async function runValidationSheetCheck() {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  if (!codesAccessGranted) {
    openCodesAccessModal();
    return;
  }

  if (validationRunLoading) return;

  validationRunLoading = true;
  validationRunStatus = 'Corriendo...';
  renderValidationRunState();

  try {
    const importedRows = await readValidationSheetRows();
    const sheetCounts = buildSheetValidationCountMap(importedRows);
    const usageCounts = await loadValidationUsageCountMap();
    const pendingRows = await loadPendingValidationRows();
    const approveIds = [];
    let skippedBySheetCount = 0;
    let skippedMissingFromSheet = 0;

    pendingRows.forEach(row => {
      const user = getUserById(row.user_id);
      const sticker = getStickerById(row.figurita_id);
      const sheetKey = makeValidationKey(user?.name || '', sticker?.name || '');
      const allowedCount = sheetCounts.get(sheetKey) || 0;
      if (allowedCount <= 0) {
        skippedMissingFromSheet += 1;
        return;
      }

      const usageKey = makeValidationUsageKey(row.user_id, row.figurita_id);
      const currentCount = usageCounts.get(usageKey) || 0;
      if (currentCount >= allowedCount) {
        skippedBySheetCount += 1;
        return;
      }

      approveIds.push(row.id);
      usageCounts.set(usageKey, currentCount + 1);
    });

    const approveResult = await processPendingValidationIds(approveIds, true);
    const statusParts = [`Aprobadas ${approveResult.processedCount}`];
    if (approveResult.failedCount > 0) statusParts.push(`Fallidas ${approveResult.failedCount}`);
    if (skippedBySheetCount > 0) statusParts.push(`Omitidas por cupo ${skippedBySheetCount}`);
    if (skippedMissingFromSheet > 0) statusParts.push(`Sin registro en hoja ${skippedMissingFromSheet}`);
    validationRunStatus = `${statusParts.join('. ')}.`;
    renderValidationRunState();
    showToast(validationRunStatus);
  } catch (error) {
    console.error(error);
    validationRunStatus = `No se pudo correr: ${String(error?.message || error || '')}`;
    renderValidationRunState();
    showToast('No se pudo correr la validación');
  } finally {
    validationRunLoading = false;
    renderValidationRunState();
  }
}

async function markMessagesAsRead(userId) {
  if (!userId) return;
  if (usingRemoteDb()) {
    const { error } = await supabaseClient.rpc('marcar_mensajes_leidos', {
      p_user_id: userId,
    });
    if (error) throw error;
    await reloadFromSource(false);
    return;
  }

  APP.mensajes.forEach(message => {
    if (message.to_user_id === userId) message.is_read = true;
  });
  rebuildDerivedData();
  updateBadges();
}

function setLocalStickerQty(userId, figuritaId, qty) {
  const idx = APP.usuarioFiguritas.findIndex(row => Number(row.user_id) === Number(userId) && Number(row.figurita_id) === Number(figuritaId));
  const existing = idx >= 0 ? APP.usuarioFiguritas[idx] : null;
  const requestedCount = Number(existing?.veces_pedidas) || 0;

  if (qty <= 0) {
    if (idx >= 0) {
      if (requestedCount > 0) {
        APP.usuarioFiguritas[idx] = {
          ...existing,
          user_id: Number(userId),
          figurita_id: Number(figuritaId),
          cantidad: 0,
          veces_pedidas: requestedCount,
          created_at: new Date().toISOString(),
        };
      } else {
        APP.usuarioFiguritas.splice(idx, 1);
      }
    }
    return;
  }

  const row = {
    ...(existing || {}),
    user_id: Number(userId),
    figurita_id: Number(figuritaId),
    cantidad: Number(qty),
    veces_pedidas: requestedCount,
    created_at: new Date().toISOString(),
  };

  if (idx >= 0) APP.usuarioFiguritas[idx] = row;
  else APP.usuarioFiguritas.push(row);
}

function getTradeItemRows(tradeId) {
  return APP.intercambioItems.filter(row => Number(row.intercambio_id) === Number(tradeId));
}

function syncValidationDecisionLocally(validation, shouldApprove, approvedByUserId) {
  if (!validation) return;

  const validationId = Number(validation.id);
  const userId = Number(validation.user_id);
  const figuritaId = Number(validation.figurita_id);
  const validationIndex = APP.validacionesSecretas.findIndex(item => Number(item.id) === validationId);
  const stamp = new Date().toISOString();

  if (shouldApprove) {
    const currentQty = getLocalQty(userId, figuritaId);
    setLocalStickerQty(userId, figuritaId, currentQty + 1);

    const rawSticker = APP.figuritas.find(item => Number(item.id) === figuritaId);
    const sticker = getStickerById(figuritaId);
    if (rawSticker) {
      rawSticker.foto_path = resolveStickerImagePath(sticker || rawSticker);
    }
  }

  if (validationIndex >= 0) {
    if (shouldApprove) {
      APP.validacionesSecretas.splice(validationIndex, 1);
    } else {
      APP.validacionesSecretas[validationIndex] = {
        ...APP.validacionesSecretas[validationIndex],
        status: 'rejected',
        responded_at: stamp,
        responded_by_user_id: approvedByUserId == null ? null : Number(approvedByUserId),
      };
    }
  }

  const pendingIndex = pendingValidationRows.findIndex(row => Number(row.id) === validationId);
  if (pendingIndex >= 0) {
    if (shouldApprove) {
      pendingValidationRows.splice(pendingIndex, 1);
    } else {
      pendingValidationRows[pendingIndex] = {
        ...pendingValidationRows[pendingIndex],
        status: 'rejected',
        responded_at: stamp,
        responded_by_user_id: approvedByUserId == null ? null : Number(approvedByUserId),
      };
    }
  }
}

function demoCreateTrade(fromUserId, toUserId, msg, offerIds, requestIds) {
  assertNoPendingOfferConflict(fromUserId, offerIds);

  const tradeId = Date.now();
  const trade = {
    id: tradeId,
    from_user_id: Number(fromUserId),
    to_user_id: Number(toUserId),
    msg: msg || null,
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
    offer: [...offerIds],
    request: [...requestIds],
  };

  APP.intercambios.unshift(trade);
  offerIds.forEach(figuritaId => {
    APP.intercambioItems.push({
      id: Number(`${tradeId}${figuritaId}1`),
      intercambio_id: tradeId,
      figurita_id: figuritaId,
      side: 'offer',
      created_at: trade.created_at,
    });
  });
  requestIds.forEach(figuritaId => {
    APP.intercambioItems.push({
      id: Number(`${tradeId}${figuritaId}2`),
      intercambio_id: tradeId,
      figurita_id: figuritaId,
      side: 'request',
      created_at: trade.created_at,
    });
  });
}

function demoApplyTrade(trade) {
  const offerIds = (trade.offer || []).map(Number);
  const requestIds = (trade.request || []).map(Number);
  const fromUserId = Number(trade.from_user_id);
  const toUserId = Number(trade.to_user_id);

  const checkCanTransfer = (userId, figuritaId) => getLocalQty(userId, figuritaId) > 0;
  if (offerIds.some(figuritaId => !checkCanTransfer(fromUserId, figuritaId))) {
    throw new Error('El usuario no tiene suficientes figuritas para ofrecer');
  }
  if (requestIds.some(figuritaId => !checkCanTransfer(toUserId, figuritaId))) {
    throw new Error('El otro usuario ya no tiene las figuritas solicitadas');
  }

  offerIds.forEach(figuritaId => {
    setLocalStickerQty(fromUserId, figuritaId, getLocalQty(fromUserId, figuritaId) - 1);
    setLocalStickerQty(toUserId, figuritaId, getLocalQty(toUserId, figuritaId) + 1);
  });

  requestIds.forEach(figuritaId => {
    setLocalStickerQty(toUserId, figuritaId, getLocalQty(toUserId, figuritaId) - 1);
    setLocalStickerQty(fromUserId, figuritaId, getLocalQty(fromUserId, figuritaId) + 1);
  });
}

function getLocalQty(userId, figuritaId) {
  const row = APP.usuarioFiguritas.find(item => Number(item.user_id) === Number(userId) && Number(item.figurita_id) === Number(figuritaId));
  return row ? Number(row.cantidad) : 0;
}

function getLocalStickerRequestCount(userId, figuritaId) {
  const row = APP.usuarioFiguritas.find(item => Number(item.user_id) === Number(userId) && Number(item.figurita_id) === Number(figuritaId));
  return row ? Number(row.veces_pedidas) || 0 : 0;
}

function incrementLocalStickerRequestCount(userId, figuritaId) {
  const idx = APP.usuarioFiguritas.findIndex(row => Number(row.user_id) === Number(userId) && Number(row.figurita_id) === Number(figuritaId));
  const stamp = new Date().toISOString();

  if (idx >= 0) {
    const existing = APP.usuarioFiguritas[idx];
    APP.usuarioFiguritas[idx] = {
      ...existing,
      user_id: Number(userId),
      figurita_id: Number(figuritaId),
      cantidad: Number(existing.cantidad) || 0,
      veces_pedidas: (Number(existing.veces_pedidas) || 0) + 1,
      created_at: stamp,
    };
    return;
  }

  APP.usuarioFiguritas.push({
    user_id: Number(userId),
    figurita_id: Number(figuritaId),
    cantidad: 0,
    veces_pedidas: 1,
    created_at: stamp,
  });
}

function demoRespondTrade(tradeId, response) {
  const trade = APP.intercambios.find(item => Number(item.id) === Number(tradeId));
  if (!trade) return;
  if (trade.status !== 'pending') throw new Error('Intercambio ya procesado');

  if (response === 'accepted') {
    demoApplyTrade(trade);
  }

  trade.status = response;
  trade.responded_at = new Date().toISOString();
}

function demoApproveValidation(validationId, approvedByUserId) {
  const validation = APP.validacionesSecretas.find(item => Number(item.id) === Number(validationId));
  if (!validation) throw new Error('validacion no encontrada');
  if (validation.status !== 'pending') throw new Error('validacion ya procesada');
  syncValidationDecisionLocally(validation, true, approvedByUserId);
}

function demoRejectValidation(validationId, approvedByUserId) {
  const validation = APP.validacionesSecretas.find(item => Number(item.id) === Number(validationId));
  if (!validation) throw new Error('validacion no encontrada');
  if (validation.status !== 'pending') throw new Error('validacion ya procesada');

  syncValidationDecisionLocally(validation, false, approvedByUserId);
}

function demoCreateMessage(fromUserId, toUserId, body) {
  APP.mensajes.unshift({
    id: Date.now(),
    from_user_id: Number(fromUserId),
    to_user_id: Number(toUserId),
    intercambio_id: null,
    body,
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

function demoCreateComment(userId, figuritaId, body) {
  APP.comentarios.unshift({
    id: Date.now(),
    user_id: Number(userId),
    figurita_id: Number(figuritaId),
    intercambio_id: null,
    body,
    created_at: new Date().toISOString(),
  });
}

async function reloadFromSource(keepView = true) {
  if (usingRemoteDb()) {
    await loadRemoteData();
  }
  rebuildDerivedData();
  ensureCurrentUser();
  updateCurrentUserDisplay();
  populateMessagePartnerSelect();
  populateCommentFiguritaSelect();
  if (keepView) renderAll();
  else {
    renderCurrentView();
    updateBadges();
  }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

async function boot() {
  hydrateUiState();

  try {
    if (usingRemoteDb()) {
      await loadRemoteData();
      DB_MODE = 'remote';
    } else {
      APP = buildFallbackData();
      DB_MODE = 'demo';
    }
  } catch (error) {
    console.error(error);
    APP = buildFallbackData();
    DB_MODE = 'demo';
    showToast('No se pudo conectar a la DB, usando modo local');
  }

  rebuildDerivedData();
  ensureCurrentUser();
  updateCurrentUserDisplay();
  populateMessagePartnerSelect();
  populateCommentFiguritaSelect();
  bindNavButtons();
  bindAuthForm();
  bindCodesUi();
  bindValidationRunUi();
  updateNavActive();
  if (currentUserId) {
    showAppShell();
    renderAll();
    if (currentView === 'mensajes') {
      void markMessagesAsRead(currentUserId).catch(error => console.error(error));
    }
  } else {
    showAuthScreen();
  }
}

document.addEventListener('DOMContentLoaded', boot);
