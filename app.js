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
let toastTimeout = null;

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

function getPendingValidation(userId, figuritaId) {
  return APP.pendingByUser?.[Number(userId)]?.[Number(figuritaId)] || null;
}

function getStickerById(id) {
  return APP.figuritasById.get(Number(id)) || null;
}

function getUserById(id) {
  return APP.usuariosById.get(Number(id)) || null;
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
          created_at: new Date().toISOString(),
        });
      } else if (fraction < 0.72) {
        usuarioFiguritas.push({
          user_id: user.id,
          figurita_id: figurita.id,
          cantidad: 2,
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
  };
}

async function fetchTable(table, orderColumn = 'id', ascending = true, columns = '*') {
  const { data, error } = await supabaseClient
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending });
  if (error) throw error;
  return data || [];
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

  const loadOrEmpty = async (table, orderColumn, ascending = true, columns = '*') => {
    try {
      return await fetchTable(table, orderColumn, ascending, columns);
    } catch (error) {
      console.warn(`No se pudieron cargar ${table} desde la DB.`, error);
      return [];
    }
  };

  const [
    usuarioFiguritas,
    validacionesSecretas,
    intercambios,
    intercambioItems,
    mensajes,
    comentarios,
  ] = await Promise.all([
    loadOrEmpty('usuario_figuritas', 'created_at'),
    loadOrEmpty('validaciones_secretas', 'created_at'),
    loadOrEmpty('intercambios', 'created_at'),
    loadOrEmpty('intercambio_items', 'id'),
    loadOrEmpty('mensajes', 'created_at'),
    loadOrEmpty('comentarios', 'created_at'),
  ]);

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
    pendingByUser: {},
    validacionesSecretasById: new Map(),
    tradeItemsByTrade: new Map(),
    stickers: [],
  };
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
  APP.usuarioFiguritas = [...APP.usuarioFiguritas];
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
    const fotoPath = f.foto_path || user?.lamina_path || '';
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
    const fotoPath = figurita.foto_path || user?.lamina_path || '';
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
  const map = ['mi-album', 'todos', 'intercambios', 'mensajes', 'ranking'];
  btns.forEach(btn => btn.classList.remove('active'));
  const idx = map.indexOf(currentView);
  if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');
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
  updateCurrentUserDisplay();
  showAppShell();
  renderAll();
}

function logoutCurrentUser() {
  currentUserId = null;
  clearAuthSession();
  clearCodesAccess();
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
  if (currentView === 'codigos' && !codesAccessGranted) {
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

  container.innerHTML = filtered.map(sticker => stickerHTML(sticker, owned[sticker.id] || 0, userId)).join('');
}

function stickerHTML(sticker, qty, userId) {
  let stateClass = '';
  let badgeHTML = '';
  const pendingValidation = userId ? getPendingValidation(userId, sticker.id) : null;
  if (qty === 0) {
    if (pendingValidation) {
      stateClass = 'pending';
      badgeHTML = '<div class="sticker-badge pending-badge">Pendiente</div>';
    } else {
      stateClass = 'missing';
      badgeHTML = '<div class="sticker-badge missing-badge">Falta</div>';
    }
  } else if (qty === 1) {
    stateClass = 'owned';
    badgeHTML = '<div class="sticker-badge">✓</div>';
  } else {
    stateClass = 'duplicate owned';
    badgeHTML = `<div class="sticker-badge dup">x${qty}</div>`;
  }

  const bg = BG_COLORS[(sticker.id - 1) % BG_COLORS.length];
  const imagePath = qty > 0 ? (sticker.foto_path || sticker.lamina_path || '') : '';
  const imageHTML = imagePath
    ? `<img class="sticker-image" src="${escapeAttr(imagePath)}" alt="${escapeAttr(sticker.name)}">`
    : pendingValidation
      ? `<div class="sticker-pending" style="background:${bg}; color:rgba(255,255,255,0.95);">Pendiente de validaci&oacute;n</div>`
      : `<div class="sticker-avatar" style="background:${bg}; color:rgba(255,255,255,0.9);">${escapeHtml(sticker.initials)}</div>`;
  const title = pendingValidation
    ? 'Pendiente de validación'
    : 'Click para activar con código secreto';

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
  const pendingValidation = currentUserId ? getPendingValidation(currentUserId, stickerId) : null;
  if (pendingValidation) {
    showToast('Pendiente de validación');
    return;
  }
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
        <div class="code-target-meta">Quedará pendiente de validación</div>
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

  if (getOwnedMap(userId)[Number(stickerId)] > 0) {
    throw new Error('figurita ya activada');
  }

  const existingPending = getPendingValidation(userId, stickerId);
  if (existingPending) {
    throw new Error('ya pendiente');
  }

  const validation = {
    id: Date.now(),
    user_id: Number(userId),
    figurita_id: Number(stickerId),
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
    responded_by_user_id: null,
  };
  APP.validacionesSecretas.unshift(validation);

  return 'pending';
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
    showToast('✅ Solicitud enviada a validación');
  } catch (error) {
    console.error(error);
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('codigo incorrecto')) {
      setStickerCodeError('Código incorrecto.');
    } else if (msg.includes('figurita ya activada')) {
      setStickerCodeError('Esa figurita ya está en tu álbum.');
    } else if (msg.includes('ya pendiente')) {
      setStickerCodeError('Ya hay una solicitud pendiente para esa figurita.');
    } else if (msg.includes('figurita no encontrada')) {
      setStickerCodeError('Figurita no encontrada.');
    } else {
      setStickerCodeError('No se pudo enviar la solicitud.');
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
      refreshPickGrids();
    };
  }

  const msgInput = document.getElementById('trade-msg');
  if (msgInput) msgInput.value = '';
  refreshPickGrids();
  document.getElementById('trade-modal').classList.add('open');
}

function refreshPickGrids() {
  const partnerId = Number(document.getElementById('trade-partner').value || 0);
  const myOwned = getOwnedMap(currentUserId);
  const partnerOwned = getOwnedMap(partnerId);

  const myDupes = APP.stickers.filter(sticker => (myOwned[sticker.id] || 0) >= 2);
  renderPickGrid('offer-grid', myDupes, selectedOffer, 'offer');

  const partnerDupesIMissing = partnerId
    ? APP.stickers.filter(sticker => (partnerOwned[sticker.id] || 0) >= 2 && (myOwned[sticker.id] || 0) === 0)
    : [];
  renderPickGrid('request-grid', partnerDupesIMissing, selectedRequest, 'request');
}

function renderPickGrid(containerId, stickers, selected, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (stickers.length === 0) {
    container.innerHTML = `<div style="color:rgba(255,255,255,0.3); font-size:13px; padding:16px; grid-column:1/-1; text-align:center;">${type === 'offer' ? 'No tienes repetidas aún' : 'Selecciona un compañero primero'}</div>`;
    return;
  }

  container.innerHTML = stickers.map(sticker => `
    <div class="pick-item ${selected.has(sticker.id) ? 'selected-pick' : ''}" onclick="togglePick(${sticker.id}, '${type}')">
      <div class="pick-num">#${String(sticker.id).padStart(2, '0')}</div>
      <div class="pick-name">${escapeHtml(sticker.name.split(' ')[0])}</div>
    </div>
  `).join('');
}

function togglePick(id, type) {
  const set = type === 'offer' ? selectedOffer : selectedRequest;
  if (set.has(id)) set.delete(id);
  else set.add(id);
  refreshPickGrids();
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
    showToast('No se pudo enviar la propuesta');
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
    const owned = getOwnedMap(user.id);
    const count = countDistinctOwned(owned);
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

async function loadPendingValidationRows() {
  if (!currentUserId || !codesAccessGranted) return [];

  if (usingRemoteDb()) {
    const { data, error } = await supabaseClient
      .from('validaciones_secretas')
      .select('id,user_id,figurita_id,status,created_at,responded_at,responded_by_user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
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
}

async function approvePendingValidation(validationId) {
  if (!currentUserId) {
    showAuthScreen();
    return;
  }

  try {
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('aprobar_validacion_secreta', {
        p_validacion_id: validationId,
        p_approved_by_user_id: currentUserId,
      });
      if (error) throw error;
      pendingValidationLoaded = false;
      await reloadFromSource();
    } else {
      demoApproveValidation(validationId, currentUserId);
      pendingValidationLoaded = false;
      rebuildDerivedData();
      renderAll();
    }

    showToast('✅ Figurita aprobada');
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
    if (usingRemoteDb()) {
      const { error } = await supabaseClient.rpc('rechazar_validacion_secreta', {
        p_validacion_id: validationId,
        p_approved_by_user_id: currentUserId,
      });
      if (error) throw error;
      pendingValidationLoaded = false;
      await reloadFromSource();
    } else {
      demoRejectValidation(validationId, currentUserId);
      pendingValidationLoaded = false;
      rebuildDerivedData();
      renderAll();
    }

    showToast('❌ Solicitud rechazada');
  } catch (error) {
    console.error(error);
    showToast('No se pudo rechazar la solicitud');
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
  if (qty <= 0) {
    if (idx >= 0) APP.usuarioFiguritas.splice(idx, 1);
    return;
  }

  const row = {
    user_id: Number(userId),
    figurita_id: Number(figuritaId),
    cantidad: Number(qty),
    created_at: new Date().toISOString(),
  };

  if (idx >= 0) APP.usuarioFiguritas[idx] = row;
  else APP.usuarioFiguritas.push(row);
}

function getTradeItemRows(tradeId) {
  return APP.intercambioItems.filter(row => Number(row.intercambio_id) === Number(tradeId));
}

function demoCreateTrade(fromUserId, toUserId, msg, offerIds, requestIds) {
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

  const sticker = getStickerById(validation.figurita_id);
  if (!sticker) throw new Error('figurita no encontrada');

  const rawSticker = APP.figuritas.find(item => Number(item.id) === Number(validation.figurita_id));
  const currentQty = getLocalQty(validation.user_id, validation.figurita_id);
  if (currentQty <= 0) {
    setLocalStickerQty(validation.user_id, validation.figurita_id, 1);
  }

  if (rawSticker && !rawSticker.foto_path) {
    rawSticker.foto_path = sticker.lamina_path || '';
  }

  validation.status = 'accepted';
  validation.responded_at = new Date().toISOString();
  validation.responded_by_user_id = approvedByUserId == null ? null : Number(approvedByUserId);
}

function demoRejectValidation(validationId, approvedByUserId) {
  const validation = APP.validacionesSecretas.find(item => Number(item.id) === Number(validationId));
  if (!validation) throw new Error('validacion no encontrada');
  if (validation.status !== 'pending') throw new Error('validacion ya procesada');

  validation.status = 'rejected';
  validation.responded_at = new Date().toISOString();
  validation.responded_by_user_id = approvedByUserId == null ? null : Number(approvedByUserId);
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
