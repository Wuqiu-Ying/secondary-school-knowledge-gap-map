/* ============================================================
 * 学科注册表
 * ------------------------------------------------------------
 * 每个学科通过一个稳定的 subject_key 注册：
 *   - senior-math / junior-math ...
 * 知识点白名单不再从这里 import，统一由 src/lib/catalog.js 管理
 * （内置 baseline pack + 用户安装的 update pack）。
 * 预留学科 ready=false，catalog 返回空数组。
 * ============================================================ */

export const STAGES = {
  junior: { key: 'junior', label: '初中', grades: [7, 8, 9], gradeLabel: '七至九年级' },
  senior: { key: 'senior', label: '高中', grades: [10, 11, 12], gradeLabel: '高一至高三' }
};

/**
 * 所有必修科目。
 * kind: academic（文化课）/ technology（技术）/ practical（体育艺术劳动）
 * kpPrefix: kp_id 的两位段码，保证跨学科全局唯一
 * ready: 是否已经导入知识点白名单
 */
export const SUBJECT_CATALOG = [
  // ---------------- 高中 ----------------
  { key: 'senior-chinese', stage: 'senior', name: '语文', short: '语文', kind: 'academic', kpPrefix: '12', ready: false, kpCount: 0, chapterCount: 0, description: '高中语文必修 + 选择性必修' },
  { key: 'senior-math', stage: 'senior', name: '数学', short: '数学', kind: 'academic', kpPrefix: '11', ready: true, kpCount: 380, chapterCount: 20, description: '高中数学 380 个知识点（已接入）' },
  { key: 'senior-english', stage: 'senior', name: '英语', short: '英语', kind: 'academic', kpPrefix: '13', ready: false, kpCount: 0, chapterCount: 0, description: '高中英语必修 + 选择性必修' },
  { key: 'senior-physics', stage: 'senior', name: '物理', short: '物理', kind: 'academic', kpPrefix: '14', ready: false, kpCount: 0, chapterCount: 0, description: '高中物理必修 + 选择性必修' },
  { key: 'senior-chemistry', stage: 'senior', name: '化学', short: '化学', kind: 'academic', kpPrefix: '15', ready: false, kpCount: 0, chapterCount: 0, description: '高中化学必修 + 选择性必修' },
  { key: 'senior-biology', stage: 'senior', name: '生物学', short: '生物', kind: 'academic', kpPrefix: '16', ready: false, kpCount: 0, chapterCount: 0, description: '高中生物学必修 + 选择性必修' },
  { key: 'senior-history', stage: 'senior', name: '历史', short: '历史', kind: 'academic', kpPrefix: '17', ready: false, kpCount: 0, chapterCount: 0, description: '高中历史《中外历史纲要》' },
  { key: 'senior-geography', stage: 'senior', name: '地理', short: '地理', kind: 'academic', kpPrefix: '18', ready: false, kpCount: 0, chapterCount: 0, description: '高中地理必修 + 选择性必修' },
  { key: 'senior-politics', stage: 'senior', name: '思想政治', short: '政治', kind: 'academic', kpPrefix: '19', ready: false, kpCount: 0, chapterCount: 0, description: '高中思想政治必修 1–4' },
  { key: 'senior-it', stage: 'senior', name: '信息技术', short: '信息技术', kind: 'technology', kpPrefix: '20', ready: false, kpCount: 0, chapterCount: 0, description: '高中信息技术必修 1–2' },
  { key: 'senior-general-tech', stage: 'senior', name: '通用技术', short: '通用技术', kind: 'technology', kpPrefix: '21', ready: false, kpCount: 0, chapterCount: 0, description: '高中通用技术必修 1–2' },
  { key: 'senior-pe', stage: 'senior', name: '体育与健康', short: '体育', kind: 'practical', kpPrefix: '22', ready: false, kpCount: 0, chapterCount: 0, description: '素养 / 技能类，暂不建知识点白名单' },
  { key: 'senior-art', stage: 'senior', name: '艺术', short: '艺术', kind: 'practical', kpPrefix: '23', ready: false, kpCount: 0, chapterCount: 0, description: '音乐 / 美术，素养类' },
  { key: 'senior-labor', stage: 'senior', name: '劳动', short: '劳动', kind: 'practical', kpPrefix: '24', ready: false, kpCount: 0, chapterCount: 0, description: '劳动教育，素养类' },

  // ---------------- 初中 ----------------
  { key: 'junior-chinese', stage: 'junior', name: '语文', short: '语文', kind: 'academic', kpPrefix: '32', ready: false, kpCount: 0, chapterCount: 0, description: '初中语文统编教材' },
  { key: 'junior-math', stage: 'junior', name: '数学', short: '数学', kind: 'academic', kpPrefix: '31', ready: false, kpCount: 0, chapterCount: 0, description: '初中数学（七至九年级）' },
  { key: 'junior-english', stage: 'junior', name: '英语', short: '英语', kind: 'academic', kpPrefix: '33', ready: false, kpCount: 0, chapterCount: 0, description: '初中英语（七至九年级）' },
  { key: 'junior-physics', stage: 'junior', name: '物理', short: '物理', kind: 'academic', kpPrefix: '34', ready: false, kpCount: 0, chapterCount: 0, description: '初中物理（八至九年级）' },
  { key: 'junior-chemistry', stage: 'junior', name: '化学', short: '化学', kind: 'academic', kpPrefix: '35', ready: false, kpCount: 0, chapterCount: 0, description: '初中化学（九年级）' },
  { key: 'junior-biology', stage: 'junior', name: '生物学', short: '生物', kind: 'academic', kpPrefix: '36', ready: false, kpCount: 0, chapterCount: 0, description: '初中生物学（七至八年级）' },
  { key: 'junior-history', stage: 'junior', name: '历史', short: '历史', kind: 'academic', kpPrefix: '37', ready: false, kpCount: 0, chapterCount: 0, description: '初中历史（七至九年级）' },
  { key: 'junior-geography', stage: 'junior', name: '地理', short: '地理', kind: 'academic', kpPrefix: '38', ready: false, kpCount: 0, chapterCount: 0, description: '初中地理（七至八年级）' },
  { key: 'junior-politics', stage: 'junior', name: '道德与法治', short: '道法', kind: 'academic', kpPrefix: '39', ready: false, kpCount: 0, chapterCount: 0, description: '初中道德与法治' },
  { key: 'junior-it', stage: 'junior', name: '信息技术', short: '信息技术', kind: 'technology', kpPrefix: '40', ready: false, kpCount: 0, chapterCount: 0, description: '初中信息技术' },
  { key: 'junior-pe', stage: 'junior', name: '体育与健康', short: '体育', kind: 'practical', kpPrefix: '41', ready: false, kpCount: 0, chapterCount: 0, description: '素养 / 技能类，暂不建知识点白名单' },
  { key: 'junior-art', stage: 'junior', name: '艺术', short: '艺术', kind: 'practical', kpPrefix: '42', ready: false, kpCount: 0, chapterCount: 0, description: '音乐 / 美术，素养类' },
  { key: 'junior-labor', stage: 'junior', name: '劳动', short: '劳动', kind: 'practical', kpPrefix: '43', ready: false, kpCount: 0, chapterCount: 0, description: '劳动教育，素养类' }
];

export const DEFAULT_SUBJECT_KEY = 'senior-math';

const CATALOG_BY_KEY = new Map(SUBJECT_CATALOG.map((s) => [s.key, s]));

export function getSubjectMeta(key) {
  return CATALOG_BY_KEY.get(key) || null;
}

export function listSubjects(stage) {
  return stage ? SUBJECT_CATALOG.filter((s) => s.stage === stage) : SUBJECT_CATALOG.slice();
}

export function readySubjects() {
  return SUBJECT_CATALOG.filter((s) => s.ready);
}

/** 兼容旧数据：没有 subject_key 的历史行按「数学」迁移到高中数学 */
export function rowSubjectKey(row) {
  if (!row) return DEFAULT_SUBJECT_KEY;
  if (row.subject_key) return row.subject_key;
  if (row.subject === '数学') return 'senior-math';
  const found = SUBJECT_CATALOG.find((s) => s.name === row.subject && s.ready);
  return found ? found.key : null;
}

export function subjectLabel(key) {
  const meta = getSubjectMeta(key);
  return meta ? `${STAGES[meta.stage]?.label || ''}${meta.name}` : key;
}

export function subjectName(key) {
  return getSubjectMeta(key)?.name || key;
}

export function subjectStageLabel(key) {
  const meta = getSubjectMeta(key);
  return meta ? STAGES[meta.stage]?.label || '' : '';
}

export function subjectForKey(key) {
  return getSubjectMeta(key) || SUBJECT_CATALOG[0];
}

export function defaultSubjectForGrade(grade) {
  const n = Number(grade);
  return n >= 7 && n <= 9 ? 'junior-math' : DEFAULT_SUBJECT_KEY;
}

export function isSubjectReady(key) {
  return !!getSubjectMeta(key)?.ready;
}
