import {
  DEFAULT_SUBJECT_KEY, getSubjectMeta, rowSubjectKey,
  subjectName, subjectLabel, defaultSubjectForGrade
} from '../data/subjects.js';
import { getKpList, getKpMap, findKp } from './catalog.js';

/* ============================================================
 * 中学知识漏洞图谱 · 核心工作流（与 Coze 版一一对应）
 *  - WF0 wf_init_profile
 *  - A1  input_new_paper
 *  - A2  wf_confirm_paper
 *  - WF2 wf_update_mastery
 *  - WF3 wf_gen_report
 * 全部为纯函数：传入 state 草稿，原地更新并返回结果。
 * 所有工作流都已按 subject_key 隔离；知识点白名单从学科注册表读取。
 * ============================================================ */

// 兼容旧调用：默认指向高中数学
export const KP = getKpList(DEFAULT_SUBJECT_KEY);
export const KP_BY_ID = getKpMap(DEFAULT_SUBJECT_KEY);
export const SUBJECT = '数学';
export const ERR_TYPES = ['概念', '计算', '审题', '步骤', '方法', '蒙对', '不会', '没时间', ''];

export const nowStr = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const dateOnly = (d = new Date()) => nowStr(d).slice(0, 10);

export function makeId(prefix = '') {
  const s = Math.random().toString(36).slice(2, 7);
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + s.toUpperCase();
}

export function emptyState() {
  return {
    version: 2,
    createdAt: nowStr(),
    profile: null,
    papers: [],
    answerLogs: [],
    kpMastery: [],
    reports: [],
    chat: [],
    pendingPaperId: '',
    lastPaperId: '',
    paperMap: '',
    activeSubject: DEFAULT_SUBJECT_KEY,
    settings: {
      ai: {
        enabled: false,
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-flash',
        visionModel: 'deepseek-flash',
        syncVision: true,
        temperature: 0.2
      },
      ui: { fontSize: 'normal' }
    },
    meta: { demo: false, tutorialDone: false, tourVersion: 0 }
  };
}

export function getKp(id, subjectKey) {
  return findKp(id, subjectKey);
}

/* ---------------- WF0 建档 ---------------- */

const GRADE_MAP = { 高一: 10, 高二: 11, 高三: 12, 初一: 7, 初二: 8, 初三: 9 };

export function normalizeGrade(input) {
  const s = String(input || '').trim();
  if (GRADE_MAP[s]) return { label: s, value: GRADE_MAP[s] };
  const n = Number(s);
  if (n >= 7 && n <= 12) {
    const label = Object.keys(GRADE_MAP).find((k) => GRADE_MAP[k] === n) || `${n}年级`;
    return { label, value: n };
  }
  const m = s.match(/高([一二三])/);
  if (m) {
    const label = `高${m[1]}`;
    return { label, value: GRADE_MAP[label] };
  }
  return null;
}

export function wfInitProfile(state, input = {}) {
  const grade = normalizeGrade(input.grade);
  const region = String(input.region || input.region_name || '').trim();
  const textbook = String(input.textbook || input.textbook_edition || '').trim();
  const errors = [];
  if (!grade) errors.push('年级（高一 / 高二 / 高三）');
  if (!region) errors.push('所在省市');
  if (!textbook) errors.push('教材版本');

  if (errors.length) {
    return { valid: false, exists: false, errors, err_msg: `还缺：${errors.join('、')}` };
  }

  const exists = !!state.profile;
  const prev = state.profile || {};
  const nickname = String(input.nickname || prev.nickname || '').trim();
  const examTarget = String(input.examTarget || prev.exam_target || '').trim();
  const summary = `${grade.label} · ${region} · ${textbook}`;
  state.profile = {
    nickname,
    grade: grade.value,
    grade_label: grade.label,
    region_name: region,
    textbook_edition: textbook,
    exam_target: examTarget,
    profile_summary: `${nickname ? nickname + ' · ' : ''}${summary}`,
    weak_subjects: prev.weak_subjects || '',
    err_patterns: prev.err_patterns || '',
    learning_style: prev.learning_style || '',
    mastery_vector: prev.mastery_vector || '',
    paper_count: prev.paper_count || 0,
    last_active_at: nowStr(),
    created_at: prev.created_at || nowStr(),
    updated_at: nowStr()
  };
  // 首次建档时把当前学科切到对应学段（初中数学 / 高中数学）
  if (!exists && !state.meta?.demo) {
    state.activeSubject = defaultSubjectForGrade(grade.value);
  }
  return { valid: true, exists, profile_summary: state.profile.profile_summary, profile: state.profile };
}

/* ---------------- A1 录入识别 ---------------- */

function qLabel(no) {
  const p = String(no).split('-');
  return p.length === 2 ? `第${p[0]}页第${p[1]}题` : `第${no}题`;
}

function flat(x) {
  return String(x || '').replace(/[\r\n]+/g, ' ').trim();
}

export function normalizeQuestion(q, i = 0) {
  const t = String(q.q_type || '');
  return {
    q_no: String(q.q_no || i + 1),
    q_type: ['choice', 'blank', 'solution'].includes(t) ? t : 'solution',
    stem: String(q.stem || q.question_text || '').slice(0, 500),
    user_answer: String(q.user_answer || '').slice(0, 300),
    correct_answer: String(q.correct_answer || '').slice(0, 300),
    is_correct: q.is_correct ? 1 : 0,
    score_rate: Number(q.score_rate ?? 0),
    full_score: Number(q.full_score ?? 0),
    difficulty: Number(q.difficulty ?? 3),
    ocr_uncertain: !!q.ocr_uncertain,
    tags: Array.isArray(q.tags) ? q.tags : q.kp_id ? [{ kp_id: q.kp_id, role: 'primary' }] : []
  };
}

export function wfAnalyzePaper(state, rawQuestions, meta = {}) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('没有识别到任何题目。请检查试卷图片是否清晰、题目是否拍全。');
  }
  const subjectKey = meta.subjectKey || state.activeSubject || DEFAULT_SUBJECT_KEY;
  const subjectMeta = getSubjectMeta(subjectKey);
  if (!subjectMeta) throw new Error(`未知学科: ${subjectKey}`);
  if (!getKpList(subjectKey).length) {
    throw new Error(`「${subjectMeta.name}」还没有导入知识点白名单，暂时不能识别试卷。请先按 docs/SUBJECTS.md 接入该学科数据。`);
  }
  const questions = rawQuestions.map(normalizeQuestion);

  // 铁律：log_id 直接用题号，题号必须卷内唯一
  const seen = {};
  questions.forEach((q, i) => {
    if (seen[q.q_no] !== undefined) {
      throw new Error(`题号重复: "${q.q_no}" 出现在第 ${seen[q.q_no] + 1} 和第 ${i + 1} 题，请检查识别出的题号`);
    }
    seen[q.q_no] = i;
  });

  const paperId = meta.paperId || makeId('P');
  const createdAt = nowStr();
  const paper = {
    paper_id: paperId,
    title: meta.title || `上传试卷 · ${dateOnly()}`,
    subject: subjectMeta.name,
    subject_key: subjectKey,
    exam_type: meta.examType || '自测',
    exam_date: meta.examDate || dateOnly(),
    score_total: 0,
    score_got: 0,
    question_cnt: questions.length,
    ocr_status: questions.some((q) => q.ocr_uncertain) ? 'partial' : 'ok',
    file_url: '',
    mastery_synced: false,
    synced_at: '',
    paper_map: '',
    created_at: createdAt
  };

  const rows = [];
  let unmappedCount = 0;
  const byKp = {};
  let unmappedQ = 0;

  questions.forEach((q) => {
    const logId = q.q_no;
    const validTags = [];
    const seenKp = new Set();
    for (const t of q.tags) {
      const kp = getKp(t.kp_id, subjectKey);
      if (!kp || seenKp.has(kp.kp_id)) continue;
      seenKp.add(kp.kp_id);
      validTags.push({ kp, role: t.role === 'primary' ? 'primary' : 'secondary', note: String(t.note || t.tag_note || '').slice(0, 60) });
    }

    if (validTags.length === 0) {
      unmappedCount += 1;
      unmappedQ += 1;
      rows.push({
        log_id: logId,
        kp_id: -1,
        kp_name: '',
        q_type: q.q_type,
        subject: subjectMeta.name,
        subject_key: subjectKey,
        source: meta.source || 'exam_upload',
        paper_id: paperId,
        tag_role: 'unmapped',
        tag_note: '',
        question_text: q.stem,
        user_answer: q.user_answer,
        correct_answer: q.correct_answer,
        is_correct: q.is_correct,
        score_rate: q.score_rate,
        full_score: q.full_score,
        confirm_status: 'pending',
        difficulty: q.difficulty,
        err_type: '',
        created_at: createdAt,
        ocr_uncertain: q.ocr_uncertain ? 1 : 0
      });
    } else {
      validTags.forEach(({ kp, role, note }) => {
        rows.push({
          log_id: logId,
          kp_id: Number(kp.kp_id),
          kp_name: kp.kp_name,
          q_type: q.q_type,
          subject: subjectMeta.name,
          subject_key: subjectKey,
          source: meta.source || 'exam_upload',
          paper_id: paperId,
          tag_role: role,
          tag_note: note,
          question_text: q.stem,
          user_answer: q.user_answer,
          correct_answer: q.correct_answer,
          is_correct: q.is_correct,
          score_rate: q.score_rate,
          full_score: q.full_score,
          confirm_status: 'pending',
          difficulty: q.difficulty,
          err_type: '',
          created_at: createdAt,
          ocr_uncertain: q.ocr_uncertain ? 1 : 0
        });
      });
    }

    // 本卷速览：每题只归一个知识点（primary 优先）
    if (validTags.length) {
      const pick = validTags.find((t) => t.role === 'primary') || validTags[0];
      const k = `${pick.kp.chapter}||${pick.kp.kp_name}`;
      if (!byKp[k]) byKp[k] = { chapter: pick.kp.chapter, name: pick.kp.kp_name, total: 0, wrong: 0 };
      byKp[k].total += 1;
      if (!q.is_correct) byKp[k].wrong += 1;
    }
  });

  // 总分/得分：按题目求和（不能按长表行）
  paper.score_total = questions.reduce((s, q) => s + Number(q.full_score || 0), 0);
  paper.score_got = questions.reduce((s, q) => s + Number(q.full_score || 0) * Number(q.score_rate || 0), 0);

  // 四问卡清单
  const blank = questions.filter((q) => !String(q.user_answer).trim());
  const uncertain = questions.filter((q) => q.ocr_uncertain);
  const wrong = questions.filter((q) => q.is_correct === 0 && String(q.user_answer).trim());
  const wrongDetail = wrong
    .map((q) => `${qLabel(q.q_no)}｜学生：${flat(q.user_answer).slice(0, 120)}｜正确：${flat(q.correct_answer).slice(0, 120)}`)
    .join('\n')
    .slice(0, 2000);

  // paperMap
  const groups = {};
  Object.values(byKp).forEach((o) => {
    if (o.wrong <= 0) return;
    if (!groups[o.chapter]) groups[o.chapter] = { wrong: 0, total: 0, items: [] };
    groups[o.chapter].wrong += o.wrong;
    groups[o.chapter].total += o.total;
    groups[o.chapter].items.push(o);
  });
  const lines = [];
  const wrongTotal = questions.filter((q) => !q.is_correct).length;
  lines.push(`本卷 ${questions.length} 题，错 ${wrongTotal} 题`);
  if (unmappedQ > 0) lines.push(`另有 ${unmappedQ} 道没能对上知识点，未计入下面的分布。`);
  const chNames = Object.keys(groups).sort((a, b) => groups[b].wrong - groups[a].wrong);
  if (chNames.length === 0) {
    lines.push('', '这张卷子没有错题 —— 全对。');
  } else {
    chNames.forEach((ch) => {
      const g = groups[ch];
      lines.push('', `【${ch}】${g.total} 题中错 ${g.wrong} 题`);
      g.items
        .sort((a, b) => b.wrong - a.wrong)
        .forEach((o) => {
          const hot = o.wrong >= 2 && o.wrong * 2 >= o.total;
          lines.push(`  · ${o.name} —— ${o.total} 题，错 ${o.wrong} 题${hot ? '  ⚠️' : ''}`);
        });
    });
  }
  const paperMap = lines.join('\n').slice(0, 1200);
  paper.paper_map = paperMap;

  state.papers.unshift(paper);
  state.answerLogs.push(...rows);
  state.profile.paper_count = (state.profile.paper_count || 0) + 1;
  state.profile.last_active_at = createdAt;
  state.pendingPaperId = paperId;
  state.lastPaperId = paperId;
  state.paperMap = paperMap;
  state.activeSubject = subjectKey;

  return {
    paperId,
    paper,
    subjectKey,
    subjectName: subjectMeta.name,
    questionCount: questions.length,
    rowCount: rows.length,
    wrongCount: wrong.length,
    wrongList: wrong.map((q) => q.q_no).join('、'),
    blankList: blank.map((q) => q.q_no).join('、'),
    uncertainList: uncertain.map((q) => q.q_no).join('、'),
    allList: questions.map((q) => q.q_no).join('、'),
    wrongDetail,
    paperMap,
    unmappedCount,
    questions: questions.map((q) => ({
      q_no: q.q_no,
      q_type: q.q_type,
      stem: q.stem,
      user_answer: q.user_answer,
      correct_answer: q.correct_answer,
      is_correct: q.is_correct,
      kp_name: (q.tags || []).map((t) => getKp(t.kp_id, subjectKey)?.kp_name).filter(Boolean).join('、')
    }))
  };
}

/* ---------------- A2 确认结算 ---------------- */

export function splitNos(v) {
  return String(v || '')
    .replace(/[，；;]/g, ',')
    .split(/[、,\s]+/)
    .map((s) => s.trim().replace(/^第/, '').replace(/题$/, ''))
    .filter(Boolean);
}

export function wfConfirmPaper(state, params = {}) {
  const paperId = String(params.paper_id || params.paperId || '');
  if (!paperId) throw new Error('缺少 paper_id');

  const pendingRows = state.answerLogs.filter((r) => r.paper_id === paperId && r.confirm_status === 'pending');
  const LIMIT = 1000;
  const truncated = pendingRows.length >= LIMIT;

  const byNo = {};
  pendingRows.forEach((r) => {
    const no = String(r.log_id || '').trim();
    if (!no) return;
    byNo[no] = { is_correct: Number(r.is_correct) ? 1 : 0, score_rate: Number(r.score_rate || 0) };
  });
  const known = Object.keys(byNo);
  const plan = {};
  const rejected = [];
  const conflicts = [];

  const RULES = [
    { key: 'missed_wrong', tag: '漏判', apply: (o) => { o.is_correct = 0; o.score_rate = 0; } },
    { key: 'extra_wrong', tag: '误判', apply: (o) => { o.is_correct = 1; o.score_rate = 1; o.err_type = ''; } },
    { key: 'blank_no_idea', tag: '空题·不会', apply: (o) => { o.is_correct = 0; o.score_rate = 0; o.err_type = '不会'; } },
    { key: 'blank_no_time', tag: '空题·没时间', apply: (o) => { o.is_correct = 0; o.score_rate = 0; o.err_type = '没时间'; } },
    { key: 'lucky_guess', tag: '蒙对', apply: (o) => { o.err_type = '蒙对'; } },
    { key: 'calc_error', tag: '计算失误', apply: (o) => { o.is_correct = 0; o.score_rate = 0; o.err_type = '计算'; } }
  ];

  RULES.forEach((rule) => {
    splitNos(params[rule.key]).forEach((no) => {
      if (!byNo[no]) {
        rejected.push({ q_no: no, type: rule.tag, reason: truncated ? '本卷数据量大，未完整加载，无法确认该题号' : '该卷待核对的题里没有这个题号' });
        return;
      }
      if (plan[no]) conflicts.push({ q_no: no, applied: rule.tag, note: '同一题被指认多次，以这个为准' });
      const base = byNo[no];
      const o = plan[no] || { q_no: no, is_correct: base.is_correct, score_rate: base.score_rate, err_type: '' };
      rule.apply(o);
      plan[no] = o;
    });
  });

  const updates = Object.keys(plan).map((k) => plan[k]);
  const ALLOWED = ['计算', '不会', '没时间', '蒙对', ''];
  updates.forEach((u) => {
    if (!ERR_TYPES.includes(u.err_type)) throw new Error(`err_type 越界: ${u.err_type} @${u.q_no}`);
    if (!ALLOWED.includes(u.err_type)) throw new Error(`A2 不允许写这个 err_type: ${u.err_type} @${u.q_no}`);
  });

  const planMap = new Map(updates.map((u) => [u.q_no, u]));
  state.answerLogs.forEach((r) => {
    if (r.paper_id !== paperId || r.confirm_status !== 'pending') return;
    const u = planMap.get(String(r.log_id));
    if (!u) return;
    r.is_correct = u.is_correct;
    r.score_rate = u.score_rate;
    r.err_type = u.err_type;
    r.confirm_status = 'confirmed';
  });

  // 本轮没有指认的 pending 题：也一并置为 confirmed（学生核对即代表认可识别结果）
  state.answerLogs.forEach((r) => {
    if (r.paper_id === paperId && r.confirm_status === 'pending') {
      r.confirm_status = 'confirmed';
    }
  });

  return {
    valid: true,
    paperId,
    updateCount: updates.length,
    rejected,
    rejectedCount: rejected.length,
    conflicts,
    conflictCount: conflicts.length,
    pendingRowCount: known.length,
    truncated
  };
}

/* ---------------- WF2 掌握度 ---------------- */

export function wfUpdateMastery(state, paperId) {
  const paper = state.papers.find((p) => p.paper_id === paperId);
  if (!paper) throw new Error('找不到这份试卷');
  const subjectKey = paper.subject_key || state.activeSubject || DEFAULT_SUBJECT_KEY;
  const subjectMeta = getSubjectMeta(subjectKey);
  if (paper.mastery_synced) {
    return { alreadySynced: true, upsertCount: 0, kpCount: 0, skippedCount: 0, weakSummary: '', subjectKey };
  }

  const rows = state.answerLogs.filter((r) => r.paper_id === paperId && r.confirm_status === 'confirmed');
  const SKIP = ['计算', '没时间'];
  const agg = {};
  const skipped = [];

  rows.forEach((r) => {
    const kpId = Number(r.kp_id);
    if (!kpId || kpId <= 0) return;
    if (r.tag_role === 'unmapped') return;
    if (Number(r.ocr_uncertain)) {
      skipped.push({ kp_id: kpId, reason: '识别存疑，不参与掌握度' });
      return;
    }
    const errType = String(r.err_type || '');
    if (SKIP.includes(errType)) {
      skipped.push({ kp_id: kpId, err_type: errType, reason: '会而失分，不惩罚' });
      return;
    }
    let ok = Number(r.is_correct) ? 1 : 0;
    let rate = Number(r.score_rate || 0);
    if (errType === '蒙对') { ok = 0; rate = 0; }

    const k = String(kpId);
    if (!agg[k]) {
      agg[k] = {
        kp_id: kpId, kp_name: r.kp_name || '', chapter: r.chapter || getKp(kpId, subjectKey)?.chapter || '未分类',
        subject: subjectMeta?.name || r.subject || '', subject_key: subjectKey,
        scoreSum: 0, fullSum: 0, n: 0, correct: 0, diffSum: 0, errTypes: []
      };
    }
    const a = agg[k];
    const fs = Number(r.full_score || 0);
    a.scoreSum += fs * rate;
    a.fullSum += fs;
    a.n += 1;
    a.correct += ok;
    a.diffSum += Number(r.difficulty || 3);
    if (!ok && errType) a.errTypes.push(errType);
  });

  const items = Object.values(agg);
  if (items.length === 0) {
    paper.mastery_synced = true;
    paper.synced_at = nowStr();
    return { alreadySynced: false, upsertCount: 0, kpCount: 0, skippedCount: skipped.length, weakSummary: '', subjectKey };
  }

  const K = 32, BASE_R = 400, SPAN_R = 16, DECAY_DAYS = 30, MAX_INTERVAL = 60;
  const now = new Date();
  const oldMap = new Map(state.kpMastery.filter((r) => rowSubjectKey(r) === subjectKey).map((r) => [String(r.kp_id), r]));
  const out = [];

  items.forEach((a) => {
    const old = oldMap.get(String(a.kp_id));
    let mastery = old ? Number(old.mastery) : 50;
    let streak = old ? Number(old.streak || 0) : 0;
    let attempt = old ? Number(old.attempt_cnt || 0) : 0;
    let correct = old ? Number(old.correct_cnt || 0) : 0;
    let errCnt = old ? Number(old.error_cnt || 0) : 0;

    if (old && old.last_practiced_at) {
      const d = (now - new Date(old.last_practiced_at)) / 86400000;
      if (d > 0) {
        const keep = Math.exp(-d / DECAY_DAYS);
        mastery = 50 + (mastery - 50) * keep;
      }
    }

    const rUser = BASE_R + mastery * SPAN_R;
    const avgDiff = a.n > 0 ? a.diffSum / a.n : 3;
    const rItem = 800 + avgDiff * 220;
    const pWin = 1 / (1 + Math.pow(10, (rItem - rUser) / 400));
    const outcome = a.fullSum > 0 ? a.scoreSum / a.fullSum : a.correct / Math.max(1, a.n);
    const rNew = rUser + K * (outcome - pWin);
    mastery = Math.max(0, Math.min(100, (rNew - BASE_R) / SPAN_R));

    attempt += a.n;
    correct += a.correct;
    errCnt += a.n - a.correct;
    streak = a.correct === a.n ? streak + 1 : 0;

    const intervalDays = streak === 0 ? 1 : Math.min(MAX_INTERVAL, Math.pow(2, streak));
    const estForget = new Date(now.getTime() + intervalDays * 86400000);
    const confidence = Math.min(1, attempt / 8);

    let status = 'learning';
    if (mastery >= 85 && confidence >= 0.6) status = 'mastered';
    else if (mastery < 60) status = 'reviewing';

    out.push({
      kp_id: a.kp_id,
      kp_name: a.kp_name || old?.kp_name || '',
      chapter: a.chapter || old?.chapter || '未分类',
      subject: a.subject || old?.subject || subjectMeta?.name || '',
      subject_key: subjectKey,
      mastery: Math.round(mastery * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      attempt_cnt: attempt,
      correct_cnt: correct,
      error_cnt: errCnt,
      streak,
      err_type: a.errTypes.length ? a.errTypes[a.errTypes.length - 1] : old?.err_type || '',
      difficulty_level: Math.max(1, Math.min(5, Math.round(avgDiff))),
      last_result: a.correct === a.n ? 1 : 0,
      last_practiced_at: nowStr(now),
      est_forget_at: nowStr(estForget),
      status
    });
  });

  out.forEach((u) => {
    const idx = state.kpMastery.findIndex((r) => Number(r.kp_id) === Number(u.kp_id));
    if (idx >= 0) state.kpMastery[idx] = u;
    else state.kpMastery.push(u);
  });

  paper.mastery_synced = true;
  paper.synced_at = nowStr();
  const weak = out.filter((u) => u.mastery < 60).sort((a, b) => a.mastery - b.mastery).slice(0, 8);

  return {
    alreadySynced: false,
    upsertCount: out.length,
    kpCount: items.length,
    skippedCount: skipped.length,
    weakSummary: weak.map((u) => `${u.kp_name}(${u.mastery})`).join('、'),
    details: out,
    subjectKey
  };
}

/* ---------------- WF3 知识漏洞图谱 ---------------- */

export function wfGenReport(state, paperId = '', opts = {}) {
  const pid = String(paperId || '');
  const hasPaper = pid !== '';
  const paper = hasPaper ? state.papers.find((p) => p.paper_id === pid) : null;
  const subjectKey = opts.subjectKey || paper?.subject_key || state.activeSubject || DEFAULT_SUBJECT_KEY;
  const subjectMeta = getSubjectMeta(subjectKey);
  const subjectTitle = subjectMeta?.name || '';
  const rows = state.kpMastery.filter((r) => rowSubjectKey(r) === subjectKey);
  const THIN = 0.3, WEAK_LINE = 60, MAX_CHARS = 2000;

  if (rows.length === 0) {
    return {
      reportText: `你的${subjectTitle}知识图谱还是空的。\n\n上传一份试卷、核对完之后，这里就会长出来。`,
      hasPaper, kpCount: 0, weakCount: 0, avgMastery: 0, weakTop: '', snapshotJson: '[]',
      reportType: hasPaper ? 'exam' : 'snapshot', reportId: '', subjectKey, subjectName: subjectTitle
    };
  }

  const thin = [], weak = [], ok = [], snap = [];
  let sumM = 0, sumN = 0;

  rows.forEach((r) => {
    const m = Number(r.mastery || 0), c = Number(r.confidence || 0);
    const item = {
      kp_id: Number(r.kp_id), kp_name: String(r.kp_name || ''), chapter: String(r.chapter || '未分类'),
      mastery: Math.round(m * 10) / 10, confidence: c, attempt: Number(r.attempt_cnt || 0),
      wrong: Number(r.error_cnt || 0), status: String(r.status || '')
    };
    snap.push({ kp_id: item.kp_id, mastery: item.mastery, confidence: item.confidence });
    if (c < THIN) { thin.push(item); return; }
    sumM += m; sumN += 1;
    if (m < WEAK_LINE) weak.push(item); else ok.push(item);
  });

  const avgMastery = sumN > 0 ? Math.round((sumM / sumN) * 10) / 10 : 0;

  const group = (arr) => {
    const g = {};
    arr.forEach((x) => { (g[x.chapter] ||= []).push(x); });
    Object.keys(g).forEach((k) => g[k].sort((a, b) => a.mastery - b.mastery));
    return g;
  };
  const chapterOrder = (g) => Object.keys(g).sort((a, b) => g[a][0].mastery - g[b][0].mastery);

  const L = [];
  L.push('【知识漏洞图谱】');
  if (subjectTitle) L.push(`学科：${subjectTitle}`);
  L.push(`共 ${rows.length} 个知识点${sumN > 0 ? `，平均掌握度 ${avgMastery}` : ''}`);
  L.push('');

  if (weak.length > 0) {
    L.push(`━━━ 需要加强（${weak.length} 个）━━━`, '');
    const g = group(weak);
    chapterOrder(g).forEach((ch) => {
      L.push(`【${ch}】`);
      g[ch].forEach((x) => {
        const flag = x.mastery < 50 && x.wrong >= 2 ? '｜⚠️⚠️' : x.wrong >= 1 ? '｜⚠️' : '';
        L.push(`· ${x.kp_name}｜掌握 ${x.mastery}｜错 ${x.wrong} 题${flag}`);
      });
      L.push('');
    });
  }

  if (ok.length > 0) {
    L.push(`━━━ 掌握良好（${ok.length} 个）━━━`, '');
    const g = group(ok);
    chapterOrder(g).forEach((ch) => {
      L.push(`【${ch}】${g[ch].map((x) => `${x.kp_name}(${x.mastery})`).join('、')}`);
    });
    L.push('');
  }

  if (thin.length > 0) {
    L.push(`━━━ 数据不足（${thin.length} 个，每题不到 3 次）━━━`, '');
    L.push(thin.map((x) => `${x.kp_name}(${x.attempt} 题)`).join('、'));
    L.push('', '这几项先不给结论 —— 做得太少，评不准。');
  }

  const reportText = L.join('\n').slice(0, MAX_CHARS);
  const weakTop = weak.slice().sort((a, b) => a.mastery - b.mastery).slice(0, 5).map((x) => x.kp_name).join('、');
  const reportType = hasPaper ? 'exam' : 'snapshot';
  let reportId = '';

  if (hasPaper) {
    reportId = makeId('R');
    state.reports.unshift({
      report_id: reportId, paper_id: pid, report_type: reportType, report_text: reportText,
      weak_top: weakTop, kp_count: rows.length, weak_count: weak.length, avg_mastery: avgMastery,
      mastery_snapshot: JSON.stringify(snap), created_at: nowStr(),
      subject_key: subjectKey, subject: subjectTitle
    });
  }

  return {
    reportText, hasPaper, kpCount: rows.length, weakCount: weak.length, avgMastery,
    weakTop, snapshotJson: JSON.stringify(snap), reportType, reportId,
    subjectKey, subjectName: subjectTitle,
    buckets: { weak, ok, thin }
  };
}

/* ---------------- 人设侧：意图与核对解析 ---------------- */

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function normalizeNums(text) {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[一二三四五六七八九十](?=题)/g, (c) => CN_NUM[c]);
}

function extractNos(clause) {
  const found = [];
  let rest = clause;

  // 第2页第4题 → 2-4
  rest = rest.replace(/第\s*(\d+)\s*页\s*第\s*(\d+)\s*题/g, (_, p, q) => {
    found.push(`${p}-${q}`);
    return ' ';
  });
  // 2-4（页-题）
  rest = rest.replace(/(\d+)\s*[-－—]\s*(\d+)/g, (_, a, b) => {
    found.push(`${a}-${b}`);
    return ' ';
  });
  // 第3题 / 3题
  rest = rest.replace(/第?\s*(\d+)\s*题/g, (_, n) => {
    found.push(n);
    return ' ';
  });
  // 裸数字列表：3、7、9
  const bare = rest.match(/\d+(?:\s*[、,，]\s*\d+)+/g);
  if (bare) {
    bare.forEach((m) => m.split(/\D+/).filter(Boolean).forEach((n) => found.push(n)));
  }
  return [...new Set(found)];
}

const CATEGORY_WORDS = [
  { key: 'blank_no_time', words: ['没时间', '时间不够', '来不及', '没做完', '时间不足'] },
  { key: 'blank_no_idea', words: ['不会', '没思路', '没想法', '完全不会'] },
  { key: 'calc_error', words: ['计算', '算错', '粗心', '算错数'] },
  { key: 'lucky_guess', words: ['蒙对', '蒙的', '猜对', '猜的', '运气'] },
  { key: 'missed_wrong', words: ['漏判', '少判', '漏了', '判对', '你判对'] },
  { key: 'extra_wrong', words: ['误判', '多判', '判错', '我做对', '我写对'] }
];

export function parseConfirmation(text) {
  const raw = normalizeNums(String(text || ''));
  if (!raw.trim()) return { recognized: false };
  if (/(算了|跳过|不核对|不核了|直接给|直接看|懒得核)/.test(raw)) {
    return { recognized: true, skip: true, params: {} };
  }

  const result = { missed_wrong: [], extra_wrong: [], calc_error: [], lucky_guess: [], blank_no_idea: [], blank_no_time: [] };

  // 按“类别词”切句：既支持“计算失误：3、7”，也支持“第 3、7 题是算错”。
  const marks = [];
  CATEGORY_WORDS.forEach((c) => {
    c.words.forEach((w) => {
      let i = raw.indexOf(w);
      while (i >= 0) {
        marks.push({ key: c.key, idx: i, len: w.length });
        i = raw.indexOf(w, i + 1);
      }
    });
  });
  marks.sort((a, b) => a.idx - b.idx);
  const isBreak = (ch) => /[，,；;。\n]/.test(ch);
  marks.forEach((m) => {
    let fwdEnd = raw.length;
    for (let i = m.idx + m.len; i < raw.length; i++) {
      if (isBreak(raw[i])) { fwdEnd = i; break; }
    }
    const fwd = raw.slice(m.idx + m.len, fwdEnd);
    let nos = extractNos(fwd);
    if (!nos.length) {
      let backStart = 0;
      for (let i = m.idx - 1; i >= 0; i--) {
        if (isBreak(raw[i])) { backStart = i + 1; break; }
      }
      nos = extractNos(raw.slice(backStart, m.idx));
    }
    if (!nos.length) {
      // 题号可能在更前面一句：“第 3 题我错了，你判对了”
      nos = extractNos(raw.slice(Math.max(0, m.idx - 40), m.idx));
    }
    if (nos.length) result[m.key].push(...nos);
  });

  // 支持结构化文本（核对卡）
  const labelMap = [
    ['missed_wrong', /漏判[:：]/], ['extra_wrong', /误判[:：]/], ['calc_error', /计算失误[:：]/],
    ['lucky_guess', /蒙对[:：]/], ['blank_no_idea', /(?:空题)?不会[:：]/], ['blank_no_time', /没时间[:：]/]
  ];
  labelMap.forEach(([key, re]) => {
    const m = raw.match(re);
    if (m) {
      const line = raw.slice(m.index).split(/[\n；;，,]/)[0].replace(re, '');
      result[key].push(...extractNos(line));
    }
  });

  Object.keys(result).forEach((k) => { result[k] = [...new Set(result[k])]; });
  const recognized = Object.values(result).some((a) => a.length > 0);
  return { recognized, skip: false, params: Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.join('、')])) };
}

export function parseProfileText(text) {
  const s = String(text || '');
  const gradeM = s.match(/(高一|高二|高三|初[一二三]|[7-9]|1[0-2])\s*(?:年级|学生|的)?/);
  const textbookM = s.match(/(人教A版|人教B版|人教版|苏教版|北师大版|沪教版|湘教版|外研版)/);
  const regionM = s.match(/([\u4e00-\u9fa5]{2,6}(?:省|市|自治区|特别行政区)(?:[\u4e00-\u9fa5]{2,6}市)?)/);
  const nicknameM = s.match(/(?:我叫|我是|叫我)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,12})/);
  return {
    grade: gradeM ? gradeM[1] : '',
    textbook: textbookM ? textbookM[1] : '',
    region: regionM ? regionM[1] : '',
    nickname: nicknameM ? nicknameM[1] : ''
  };
}

export function weakKps(state, limit = 8, subjectKey) {
  const key = subjectKey || state.activeSubject || DEFAULT_SUBJECT_KEY;
  return state.kpMastery
    .filter((r) => rowSubjectKey(r) === key && Number(r.confidence) >= 0.3 && Number(r.mastery) < 60)
    .sort((a, b) => Number(a.mastery) - Number(b.mastery))
    .slice(0, limit);
}

export function stats(state, subjectKey) {
  const key = subjectKey || state.activeSubject || DEFAULT_SUBJECT_KEY;
  const meta = getSubjectMeta(key);
  const rows = state.kpMastery.filter((r) => rowSubjectKey(r) === key);
  const papers = state.papers.filter((p) => rowSubjectKey(p) === key);
  const reliable = rows.filter((r) => Number(r.confidence) >= 0.3);
  const avg = reliable.length ? Math.round((reliable.reduce((s, r) => s + Number(r.mastery), 0) / reliable.length) * 10) / 10 : 0;
  const whitelist = getKpList(key).length;
  return {
    kpCount: rows.length,
    weakCount: reliable.filter((r) => Number(r.mastery) < 60).length,
    goodCount: reliable.filter((r) => Number(r.mastery) >= 60).length,
    thinCount: rows.filter((r) => Number(r.confidence) < 0.3).length,
    avgMastery: avg,
    paperCount: papers.length,
    confirmedPapers: papers.filter((p) => p.mastery_synced).length,
    whitelist,
    coverage: whitelist ? Math.min(100, Math.round((rows.length / whitelist) * 1000) / 10) : 0,
    subjectKey: key,
    subjectName: meta?.name || '',
    subjectLabel: subjectLabel(key),
    ready: !!meta?.ready
  };
}
