import seniorMathRaw from '../data/kp/senior-math.js';
import { DEFAULT_SUBJECT_KEY, getSubjectMeta } from '../data/subjects.js';

/* ============================================================
 * 知识点库（catalog）· 版本化 Pack
 * ------------------------------------------------------------
 * 三层：
 *   1. builtin pack  随 App 发布，只读（高中数学 380 条）
 *   2. update pack   用户导入，存 IndexedDB，可切换/回滚
 *   3. active 指针   每个 subject 当前用哪个 pack（localStorage）
 *
 * 页面通过 getKpList()/getKpContext() 读取，不再静态 import 数据文件。
 * ============================================================ */

export const PACK_FORMAT = 'xq-kp-pack/v1';
const ACTIVE_KEY = 'xueqing-catalog-active-v1';
const DB_NAME = 'xueqing-catalog';
const DB_STORE = 'packs';
const DB_VERSION = 1;

const packs = new Map();          // pack_id -> pack
const active = new Map();         // subject_key -> pack_id
const builtinBySubject = new Map();
const kpMaps = new Map();         // `${subject}:${packId}` -> Map
const listeners = new Set();
let initPromise = null;
let dbPromise = null;

/* ---------------- 工具 ---------------- */

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function checksum(entries) {
  return fnv1a(JSON.stringify(entries));
}

function normalizeEntries(entries, meta) {
  return (entries || []).map((k) => ({
    ...k,
    kp_id: Number(k.kp_id),
    subject_key: meta.key,
    stage: meta.stage,
    stage_label: meta.stage === 'junior' ? '初中' : '高中',
    subject: meta.name,
    status: k.status || 'active'
  }));
}

function sealPack(pack) {
  const meta = getSubjectMeta(pack.manifest?.subject_key);
  if (!meta) throw new Error('未知学科: ' + pack.manifest?.subject_key);
  const entries = normalizeEntries(pack.entries, meta);
  const chapters = new Set(entries.map((e) => e.chapter).filter(Boolean));
  return {
    format: PACK_FORMAT,
    manifest: {
      ...pack.manifest,
      kp_count: entries.length,
      chapter_count: chapters.size,
      checksum: checksum(entries)
    },
    entries
  };
}

function makeBuiltin(subjectKey, entries, manifest) {
  const pack = sealPack({
    format: PACK_FORMAT,
    manifest: {
      pack_id: `builtin-${subjectKey}-2026.10`,
      subject_key: subjectKey,
      stage: getSubjectMeta(subjectKey)?.stage || 'senior',
      textbook: '通用',
      region: '全国',
      version: '2026.10.17',
      published_at: '2026-10-17',
      min_app_version: '0.1.0',
      source: '项目内置（kp_dict_高中_数学_v2.xlsx）',
      license: '项目自建白名单',
      notes: '内置 baseline，不可删除',
      ...manifest
    },
    entries
  });
  packs.set(pack.manifest.pack_id, pack);
  builtinBySubject.set(subjectKey, pack.manifest.pack_id);
  active.set(subjectKey, pack.manifest.pack_id);
  return pack;
}

/* ---------------- IndexedDB ---------------- */

function hasIDB() {
  return typeof indexedDB !== 'undefined';
}

function openDB() {
  if (!hasIDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGetAll() {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(pack) {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(pack, pack.manifest.pack_id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- active 指针 ---------------- */

function readPointers() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

function savePointers() {
  if (typeof localStorage === 'undefined') return;
  const obj = {};
  active.forEach((v, k) => { obj[k] = v; });
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(obj)); } catch (_) {}
}

function applyMeta(pack) {
  const meta = getSubjectMeta(pack.manifest.subject_key);
  if (!meta) return;
  meta.ready = true;
  meta.kpCount = pack.entries.length;
  meta.chapterCount = pack.manifest.chapter_count;
  meta.activePack = pack.manifest.pack_id;
}

/* ---------------- 初始化 ---------------- */

async function doInit() {
  // 内置 pack 在模块加载时就已存在，保证 core 同步调用可用
  try {
    const installed = await idbGetAll();
    installed.forEach((pack) => {
      const r = validatePack(pack);
      if (r.ok) packs.set(pack.manifest.pack_id, pack);
      else console.warn('跳过损坏的知识点包', pack?.manifest?.pack_id, r.errors);
    });
  } catch (e) {
    console.warn('读取知识点包失败，仅使用内置 pack', e);
  }

  const pointers = readPointers();
  Object.entries(pointers).forEach(([subjectKey, packId]) => {
    if (getSubjectMeta(subjectKey) && packs.has(packId)) active.set(subjectKey, packId);
  });

  packs.forEach((p) => { if (active.get(p.manifest.subject_key) === p.manifest.pack_id) applyMeta(p); });
  kpMaps.clear();
  emitCatalog();
}

export function initCatalog() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

/* ---------------- pack 校验 ---------------- */

export function validatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return { ok: false, errors: ['不是对象'] };
  if (pack.format !== PACK_FORMAT) errors.push(`format 必须是 ${PACK_FORMAT}`);
  const m = pack.manifest;
  if (!m || typeof m !== 'object') {
    errors.push('缺少 manifest');
    return { ok: false, errors };
  }
  const meta = getSubjectMeta(m.subject_key);
  if (!meta) errors.push(`未知 subject_key: ${m.subject_key}`);
  if (!m.pack_id) errors.push('manifest.pack_id 为空');
  if (!m.version) errors.push('manifest.version 为空');
  if (!Array.isArray(pack.entries) || pack.entries.length === 0) errors.push('entries 为空');
  if (errors.length) return { ok: false, errors };

  const ids = new Set();
  const names = new Set();
  const aliases = new Map();
  const entries = normalizeEntries(pack.entries, meta);
  entries.forEach((k, i) => {
    const where = `第 ${i + 1} 条`;
    if (!Number.isInteger(k.kp_id) || k.kp_id <= 0) errors.push(`${where}: kp_id 非法`);
    else if (!String(k.kp_id).startsWith(meta.kpPrefix)) errors.push(`${where}: kp_id ${k.kp_id} 不以段码 ${meta.kpPrefix} 开头`);
    if (!k.kp_name) errors.push(`${where}: kp_name 为空`);
    if (!k.chapter) errors.push(`${where}: chapter 为空`);
    if (ids.has(k.kp_id)) errors.push(`${where}: kp_id 重复 ${k.kp_id}`);
    if (names.has(k.kp_name)) errors.push(`${where}: kp_name 重复 ${k.kp_name}`);
    ids.add(k.kp_id);
    names.add(k.kp_name);
    String(k.aliases || '').split('|').map((x) => x.trim()).filter(Boolean).forEach((a) => {
      if (aliases.has(a)) errors.push(`${where}: 别名重复 ${a}（${aliases.get(a)} / ${k.kp_name}）`);
      aliases.set(a, k.kp_name);
    });
    if (k.grade_min && k.grade_max && Number(k.grade_min) > Number(k.grade_max)) {
      errors.push(`${where}: grade_min > grade_max`);
    }
  });
  if (m.kp_count !== undefined && Number(m.kp_count) !== entries.length) {
    errors.push(`manifest.kp_count=${m.kp_count}，实际 ${entries.length}`);
  }
  if (m.checksum && m.checksum !== checksum(entries)) {
    errors.push('checksum 不匹配（文件可能被改动或损坏）');
  }
  return { ok: errors.length === 0, errors };
}

/* ---------------- 读接口 ---------------- */

export function getActivePack(subjectKey = DEFAULT_SUBJECT_KEY) {
  const pid = active.get(subjectKey);
  return (pid && packs.get(pid)) || packs.get(builtinBySubject.get(subjectKey)) || null;
}

export function getPack(packId) {
  return packs.get(packId) || null;
}

export function getKpList(subjectKey = DEFAULT_SUBJECT_KEY) {
  return getActivePack(subjectKey)?.entries || [];
}

export function getKpMap(subjectKey = DEFAULT_SUBJECT_KEY) {
  const pack = getActivePack(subjectKey);
  if (!pack) return new Map();
  const key = `${subjectKey}:${pack.manifest.pack_id}`;
  if (!kpMaps.has(key)) kpMaps.set(key, new Map(pack.entries.map((k) => [Number(k.kp_id), k])));
  return kpMaps.get(key);
}

export function findKp(kpId, subjectKey) {
  const id = Number(kpId);
  if (subjectKey) {
    const hit = getKpMap(subjectKey).get(id);
    if (hit) return hit;
    for (const p of packs.values()) {
      if (p.manifest.subject_key !== subjectKey) continue;
      const found = p.entries.find((k) => Number(k.kp_id) === id);
      if (found) return found;
    }
    return null;
  }
  for (const p of packs.values()) {
    const found = p.entries.find((k) => Number(k.kp_id) === id);
    if (found) return found;
  }
  return null;
}

export function listPacks(subjectKey) {
  return [...packs.values()]
    .filter((p) => !subjectKey || p.manifest.subject_key === subjectKey)
    .map((p) => ({
      ...p.manifest,
      builtin: p.manifest.pack_id === builtinBySubject.get(p.manifest.subject_key),
      active: active.get(p.manifest.subject_key) === p.manifest.pack_id
    }))
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
}

export function getCatalogInfo(subjectKey = DEFAULT_SUBJECT_KEY) {
  const pack = getActivePack(subjectKey);
  const meta = getSubjectMeta(subjectKey);
  return {
    subjectKey,
    active: pack?.manifest || null,
    installed: listPacks(subjectKey),
    builtinId: builtinBySubject.get(subjectKey) || '',
    ready: !!meta?.ready,
    kpCount: pack?.entries.length || 0
  };
}

/** 按用户学段/年级/教材/地区筛候选；模型只需要这个，不需要浏览器 */
export function getKpContext({ subjectKey = DEFAULT_SUBJECT_KEY, grade, textbook, region, query = '', limit = 20 } = {}) {
  const pack = getActivePack(subjectKey);
  if (!pack) return { pack: null, total: 0, items: [] };
  const g = Number(grade) || 0;
  const q = String(query || '').trim();
  const qLower = q.toLowerCase();
  const textbookOk = !textbook || !pack.manifest.textbook || pack.manifest.textbook === '通用' || pack.manifest.textbook === textbook;
  const regionOk = !region || !pack.manifest.region || pack.manifest.region === '全国' || String(pack.manifest.region).includes(region) || String(region).includes(pack.manifest.region);

  const scored = [];
  for (const k of pack.entries) {
    if (k.status !== 'active') continue;
    if (g && ((k.grade_min && g < k.grade_min) || (k.grade_max && g > k.grade_max))) continue;
    let score = 0;
    if (q) {
      const hay = `${k.kp_name} ${k.aliases || ''} ${k.annotation || ''} ${k.chapter || ''}`.toLowerCase();
      if (k.kp_name === q) score += 100;
      if (k.kp_name.includes(q)) score += 40;
      if (String(k.aliases || '').includes(q)) score += 20;
      if (hay.includes(qLower)) score += 10;
      if (k.chapter && k.chapter.includes(q)) score += 6;
    }
    if (!q) score = 1;
    if (score > 0) scored.push({ kp: k, score });
  }
  scored.sort((a, b) => b.score - a.score || String(a.kp.kp_name).localeCompare(String(b.kp.kp_name)));
  return {
    pack: { ...pack.manifest, textbook_ok: textbookOk, region_ok: regionOk },
    total: scored.length,
    items: scored.slice(0, Math.max(1, Number(limit) || 20)).map((x) => ({
      kp_id: x.kp.kp_id,
      kp_name: x.kp.kp_name,
      aliases: x.kp.aliases,
      annotation: x.kp.annotation,
      chapter: x.kp.chapter,
      unit: x.kp.unit,
      grade_min: x.kp.grade_min,
      grade_max: x.kp.grade_max,
      pack_id: pack.manifest.pack_id,
      pack_version: pack.manifest.version
    }))
  };
}

/* ---------------- 写接口 ---------------- */

export async function installPack(input, { persist = true, activate = true } = {}) {
  const r = validatePack(input);
  if (!r.ok) {
    const err = new Error('知识点包校验失败：' + r.errors.slice(0, 6).join('；'));
    err.errors = r.errors;
    throw err;
  }
  const pack = sealPack(input);
  // seal 后 checksum 变了，重新校验一次
  const r2 = validatePack(pack);
  if (!r2.ok) throw new Error('知识点包校验失败：' + r2.errors.slice(0, 6).join('；'));
  packs.set(pack.manifest.pack_id, pack);
  if (persist) await idbPut(pack);
  if (activate) {
    active.set(pack.manifest.subject_key, pack.manifest.pack_id);
    savePointers();
    applyMeta(pack);
  }
  kpMaps.clear();
  emitCatalog();
  return pack;
}

export function activatePack(packId) {
  const pack = packs.get(packId);
  if (!pack) throw new Error('找不到知识点包: ' + packId);
  active.set(pack.manifest.subject_key, packId);
  savePointers();
  applyMeta(pack);
  kpMaps.clear();
  emitCatalog();
  return pack;
}

export function restoreBuiltin(subjectKey = DEFAULT_SUBJECT_KEY) {
  const bid = builtinBySubject.get(subjectKey);
  if (!bid) throw new Error('该学科没有内置知识点包');
  active.set(subjectKey, bid);
  savePointers();
  applyMeta(packs.get(bid));
  kpMaps.clear();
  emitCatalog();
  return packs.get(bid);
}

export function exportActivePack(subjectKey = DEFAULT_SUBJECT_KEY) {
  const pack = getActivePack(subjectKey);
  if (!pack) throw new Error('当前学科没有知识点包');
  return JSON.stringify({ format: PACK_FORMAT, manifest: pack.manifest, entries: pack.entries }, null, 2);
}

export function subscribeCatalog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitCatalog() {
  listeners.forEach((fn) => fn());
}

/* ---------------- 内置 pack ---------------- */

makeBuiltin('senior-math', seniorMathRaw, {
  version: '2026.10.17',
  kp_count: seniorMathRaw.length
});
