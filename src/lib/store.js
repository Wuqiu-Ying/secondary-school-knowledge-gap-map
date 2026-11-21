import { emptyState, nowStr, wfInitProfile, wfAnalyzePaper, wfConfirmPaper, wfUpdateMastery, wfGenReport, makeId } from './core.js';
import { buildDemoPaperA, buildDemoPaperB, buildDemoDrills, buildDemoProfile } from './demo.js';
import { DEFAULT_SUBJECT_KEY, getSubjectMeta, rowSubjectKey } from '../data/subjects.js';
import { normalizeFontSize } from './ui.js';

const KEY = 'xueqing-analyst-state-v2';
let state = load();
const listeners = new Set();

function migrate(s) {
  if (!s || typeof s !== 'object') return emptyState();
  if (!s.activeSubject || !getSubjectMeta(s.activeSubject)) s.activeSubject = DEFAULT_SUBJECT_KEY;
  if (!s.settings) s.settings = { ...emptyState().settings };
  if (!s.settings.ui) s.settings.ui = { fontSize: 'normal' };
  s.settings.ui.fontSize = normalizeFontSize(s.settings.ui.fontSize);
  s.meta = { ...emptyState().meta, ...(s.meta || {}) };
  // 旧版未配置 Key 的 DeepSeek 默认值升级到当前 flash（配置过 Key 的不动）
  const ai = s.settings.ai;
  if (ai && ai.provider === 'deepseek' && !ai.apiKey
    && ai.baseUrl === 'https://api.deepseek.com/v1' && ai.model === 'deepseek-chat') {
    ai.baseUrl = 'https://api.deepseek.com';
    ai.model = 'deepseek-flash';
    ai.visionModel = ai.visionModel || 'deepseek-flash';
  }
  if (ai) {
    if (typeof ai.syncVision !== 'boolean') ai.syncVision = !ai.visionModel || ai.visionModel === ai.model;
    if (ai.syncVision) ai.visionModel = ai.model;
  }

  ['papers', 'answerLogs', 'kpMastery', 'reports'].forEach((list) => {
    (s[list] || []).forEach((row) => {
      if (!row.subject_key) row.subject_key = rowSubjectKey(row) || DEFAULT_SUBJECT_KEY;
    });
  });
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 2) return emptyState();
    return migrate({ ...emptyState(), ...parsed, settings: { ...emptyState().settings, ...(parsed.settings || {}) } });
  } catch (e) {
    console.warn('读取本地数据失败，已回退到空状态', e);
    return emptyState();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存本地数据失败（可能超出配额）', e);
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function update(mutator) {
  const draft = structuredClone(state);
  const result = mutator(draft);
  state = draft;
  persist();
  emit();
  return result;
}

export function setState(next) {
  state = migrate(next);
  persist();
  emit();
}

export function setActiveSubject(key) {
  if (!getSubjectMeta(key)) return false;
  update((s) => {
    s.activeSubject = key;
  });
  return true;
}

export function message(role, text, extra = {}) {
  return { id: makeId('M'), role, text, time: nowStr(), ...extra };
}

export function pushMessage(msg) {
  update((s) => {
    s.chat.push(msg);
    if (s.chat.length > 200) s.chat = s.chat.slice(-200);
  });
}

export function clearChat(keepWelcome) {
  update((s) => {
    s.chat = keepWelcome ? s.chat.slice(0, 1) : [];
  });
}

export function buildConfirmPayload(result, title) {
  return {
    paperId: result.paperId,
    subjectKey: result.subjectKey,
    subjectName: result.subjectName,
    title: title || '本次上传的试卷',
    questionCount: result.questionCount,
    wrongList: result.wrongList,
    blankList: result.blankList,
    uncertainList: result.uncertainList,
    allList: result.allList,
    paperMap: result.paperMap,
    wrongDetail: result.wrongDetail,
    questions: result.questions,
    unmappedCount: result.unmappedCount
  };
}

/* ---------------- 演示数据 ---------------- */

export function loadDemo() {
  const tutorialDone = !!state.meta?.tutorialDone;
  const tourVersion = Number(state.meta?.tourVersion) || 0;
  const s = emptyState();
  s.meta.demo = true;
  s.meta.tutorialDone = tutorialDone;
  s.meta.tourVersion = tourVersion;
  s.activeSubject = 'senior-math';
  wfInitProfile(s, buildDemoProfile());

  // 八轮巩固：让一部分知识点攒够作答次数，掌握度才不是“数据不足”
  const drills = buildDemoDrills();
  drills.forEach((d, i) => {
    const r = wfAnalyzePaper(s, d.questions, { ...d.meta, paperId: `P-DEMO-DRILL-${i + 1}`, source: 'self_report' });
    wfConfirmPaper(s, { paper_id: r.paperId });
    wfUpdateMastery(s, r.paperId);
    if (i === drills.length - 1) wfGenReport(s, r.paperId);
  });

  const a = wfAnalyzePaper(s, buildDemoPaperA().questions, { ...buildDemoPaperA().meta, paperId: 'P-DEMO-HISTORY' });
  const ca = wfConfirmPaper(s, {
    paper_id: a.paperId,
    calc_error: '1-4、1-12',
    lucky_guess: '1-9',
    blank_no_time: '1-15'
  });
  const ma = wfUpdateMastery(s, a.paperId);
  const ra = wfGenReport(s, a.paperId);

  const b = wfAnalyzePaper(s, buildDemoPaperB().questions, { ...buildDemoPaperB().meta, paperId: 'P-DEMO-MOCK' });
  s.paperMap = b.paperMap;
  s.pendingPaperId = b.paperId;

  // 让演示数据的报告时间与考试日期一致，趋势图才有意义
  s.papers.forEach((p) => { p.created_at = `${p.exam_date} 20:00:00`; });
  s.reports.forEach((r) => {
    const p = s.papers.find((x) => x.paper_id === r.paper_id);
    if (p) r.created_at = `${p.exam_date} 20:00:00`;
  });
  s.reports.sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));

  s.chat = [
    message('assistant', `我是你的知识漏洞图谱助手。\n\n把试卷照片发给我，我帮你看清知识漏洞在哪。\n\n现在是演示档案：**${s.profile.profile_summary}**。历史里有 8 轮巩固练习和一份函数单元测，已经核对过；最近这份模拟卷还没核对。`, { kind: 'welcome' }),
    message('assistant', `历史卷「${a.paper.title}」已经核对完，图谱里有 ${s.kpMastery.length} 个知识点（其中 ${s.kpMastery.filter((x) => x.confidence >= 0.3).length} 个已有足够样本）。\n\n下面这份「${b.paper.title}」还没核对 —— 四问卡在下面，答完就会更新图谱。`, {
      kind: 'note'
    }),
    message('assistant', '', { kind: 'confirm', payload: buildConfirmPayload(b, b.paper.title) })
  ];

  state = s;
  persist();
  emit();
  return { paperId: b.paperId, kpCount: s.kpMastery.length, report: ra };
}

/* ---------------- 数据管理 ---------------- */

export function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `中学知识漏洞图谱-备份-${nowStr().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importState(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || !Array.isArray(parsed.papers) || !parsed.profile) {
    throw new Error('这不是有效的中学知识漏洞图谱备份文件');
  }
  state = migrate({ ...emptyState(), ...parsed, version: 2 });
  persist();
  emit();
}

export function resetAll() {
  state = emptyState();
  localStorage.removeItem(KEY);
  persist();
  emit();
}
