import {
  parseConfirmation, parseProfileText, wfInitProfile, wfAnalyzePaper, wfConfirmPaper,
  wfUpdateMastery, wfGenReport, stats, weakKps, getKp, nowStr
} from './core.js';
import { getState, update, pushMessage, message, buildConfirmPayload, loadDemo } from './store.js';
import { aiConfigured, visionConfigured, buildAIQuestions, groundedReply, chatText, extractJson } from './ai.js';
import { getSubjectMeta, rowSubjectKey, subjectLabel } from '../data/subjects.js';

/* ============================================================
 * 人设「判定顺序」的应用层实现：
 *   有图？→ 建档？→ pending 非空？→ 图谱意图？→ 正常对话
 * 工作流本身在 core.js，本文件只负责“对话行为”。
 * ============================================================ */

export function contextText(s) {
  const key = s.activeSubject;
  const st = stats(s, key);
  const weak = weakKps(s, 10, key).map((r) => `${r.kp_name}(掌握${r.mastery}，错${r.error_cnt}题)`).join('；');
  const papers = s.papers
    .filter((p) => rowSubjectKey(p) === key)
    .slice(0, 5)
    .map((p) => `${p.title}（${p.question_cnt}题，${p.mastery_synced ? '已核对' : '待核对'}）`).join('；');
  const lastReport = s.reports.find((r) => rowSubjectKey(r) === key)?.report_text?.slice(0, 1200) || '暂无';
  return `当前学科：${subjectLabel(key)}
档案：${s.profile?.profile_summary || '未建档'}
知识点覆盖：${st.kpCount}/${st.whitelist}，平均掌握度 ${st.avgMastery}，需要加强 ${st.weakCount} 个，数据不足 ${st.thinCount} 个。
最薄弱：${weak || '暂无可靠数据'}
最近的卷子：${papers || '暂无'}
最近一次图谱：
${lastReport}`;
}

function fallbackReply(text, s) {
  const st = stats(s);
  if (/你好|在吗|hi|hello/i.test(text)) {
    return `我在。\n\n你可以把试卷照片发给我，或者直接说「看我的图谱」。\n\n现在档案里已经记录了 ${st.paperCount} 份卷子、${st.kpCount} 个知识点。`;
  }
  if (/怎么用|帮助|使用|能做什么/.test(text)) {
    return `我只做一件事：把试卷变成你能看懂的知识漏洞。\n\n1. 把试卷照片发给我（或点输入框左边的图片按钮）\n2. 我会给出【试卷核对】四问卡：错题清单、计算失误、蒙对、空题\n3. 你核对完，我更新掌握度，再给你本卷速览\n4. 想看整体情况时，说「看我的图谱」\n\n不做的事：不催你学习、不替你定计划。`;
  }
  return `我暂时没有接入大模型，只能用数据回答有限的问题。\n\n你可以试试：\n· 「看我的图谱」—— 我按真实掌握度生成\n· 发一张试卷照片 —— 需要先在设置里配置视觉模型\n· 「怎么用」—— 看完整流程\n\n当前数据：${st.paperCount} 份卷子，${st.kpCount} 个知识点，平均掌握度 ${st.avgMastery}。`;
}

/* ---------------- 消息工具 ---------------- */

function pushAssistant(text, extra = {}) {
  pushMessage(message('assistant', text, extra));
}

function pushNote(text, extra = {}) {
  pushAssistant(text, { kind: 'note', ...extra });
}

function pushError(text) {
  pushAssistant(text, { kind: 'error' });
}

function patchMessage(id, patch) {
  update((s) => {
    const m = s.chat.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  });
}

/* ---------------- 建档 ---------------- */

export async function submitProfile(input) {
  let result;
  update((s) => {
    result = wfInitProfile(s, input);
  });
  if (!result.valid) {
    pushNote(`建档还差一点：${result.err_msg}。\n把年级、所在省市、教材版本一起告诉我就行。`);
    return result;
  }
  const active = getState();
  const subjectMeta = getSubjectMeta(active.activeSubject);
  if (!subjectMeta?.ready) {
    pushAssistant(
      `${result.exists ? '档案已更新' : '记下了'}：${result.profile_summary}。\n\n当前学科是**${subjectLabel(active.activeSubject)}**，数据接口已经预留，但还没有导入知识点白名单。\n\n可以在左侧学科选择器切到**高中数学**，或按 docs/SUBJECTS.md 接入这个学科。`,
      { kind: 'profile' }
    );
    return result;
  }
  pushAssistant(
    `${result.exists ? '档案已更新' : '记下了'}：${result.profile_summary}。\n\n现在可以把${subjectMeta.name}试卷照片发给我了 —— 我会先识别，再给你四问核对卡。`,
    { kind: 'profile' }
  );
  return result;
}

/* ---------------- 图片上传 ---------------- */

async function handleImages(images) {
  const s = getState();
  if (!s.profile) {
    pushNote('收到图片了，不过我还不知道你是几年级、用的哪版教材，标知识点可能会标错。\n\n请先完成建档（年级 / 所在省市 / 教材版本），然后把卷子重新发给我。');
    return;
  }
  const meta = getSubjectMeta(s.activeSubject);
  if (!meta?.ready) {
    pushNote(`「${subjectLabel(s.activeSubject)}」的数据接口已经预留，但还没有导入知识点白名单，暂时不能识别试卷。\n\n当前可用的学科是**高中数学**，可以在左侧学科选择器里切换。`);
    return;
  }
  const ai = s.settings.ai;
  if (!visionConfigured(ai)) {
    pushNote(
      '现在还没有接入**视觉模型**，所以我读不了这张照片。\n\n两个办法：\n1. 到「设置 → AI 接口」配置一个支持图片的模型（如 qwen-vl-max、glm-4v-plus、gpt-4o-mini），存好后重新上传；\n2. 先说「载入演示试卷」，用内置的模拟卷体验完整流程。',
      { kind: 'needVision' }
    );
    return;
  }

  const wait = message('assistant', `收到你的${meta.name}试卷了，正在识别（大约需要 2–3 分钟，请不要关掉对话）……`, { kind: 'progress' });
  pushMessage(wait);
  try {
    const questions = await buildAIQuestions(ai, images, {
      subjectKey: s.activeSubject,
      onProgress: (p) => patchMessage(wait.id, { text: p })
    });
    let result;
    update((st) => {
      result = wfAnalyzePaper(st, questions, {
        title: `${meta.name}上传试卷 · ${nowStr().slice(5, 10)}`,
        examType: '自测',
        subjectKey: s.activeSubject
      });
    });
    const blankN = result.blankList ? result.blankList.split('、').filter(Boolean).length : 0;
    patchMessage(wait.id, { text: `识别完成：共 ${result.questionCount} 道题，${blankN} 道空题。`, kind: 'note' });
    pushAssistant('', { kind: 'confirm', payload: buildConfirmPayload(result, result.paper.title) });
  } catch (e) {
    patchMessage(wait.id, { text: `识别失败：${e.message}`, kind: 'error' });
  }
}

/* ---------------- 核对与结算 ---------------- */

export async function submitConfirmation(params, summaryText) {
  if (summaryText) pushMessage(message('user', summaryText));
  await runSettlement(params);
}

export async function runSettlement(params) {
  const s0 = getState();
  const paper = s0.papers.find((p) => p.paper_id === params.paper_id);
  const wait = message('assistant', '收到，正在把核对结果落库，并更新掌握度……', { kind: 'progress' });
  pushMessage(wait);

  let confirm, mastery, report, error;
  update((s) => {
    try {
      confirm = wfConfirmPaper(s, params);
      mastery = wfUpdateMastery(s, params.paper_id);
      report = wfGenReport(s, params.paper_id);
      s.pendingPaperId = '';
      s.lastPaperId = params.paper_id;
      s.profile.last_active_at = nowStr();
    } catch (e) {
      error = e;
    }
  });

  if (error) {
    patchMessage(wait.id, { text: `核对写入失败：${error.message}`, kind: 'error' });
    return;
  }

  const lines = [];
  if (confirm.updateCount > 0) lines.push(`已记录 ${confirm.updateCount} 处修正。`);
  else lines.push('这份卷子没有需要修改的地方，识别结果已确认。');
  if (confirm.rejectedCount > 0) {
    lines.push(`有 ${confirm.rejectedCount} 个题号我没找到：${confirm.rejected.map((r) => r.q_no).join('、')}。你看看题号对吗？`);
  }
  if (confirm.truncated) lines.push('这份卷子题量较大，本次核对可能没有覆盖全部题目，建议分开上传。');

  patchMessage(wait.id, { text: lines.join('\n'), kind: 'note' });

  pushAssistant('', {
    kind: 'settlement',
    payload: {
      paperId: params.paper_id,
      title: paper?.title || '本次试卷',
      confirm,
      mastery,
      reportText: report.reportText,
      paperMap: paper?.paper_map || s0.paperMap,
      avgMastery: report.avgMastery,
      weakCount: report.weakCount,
      kpCount: report.kpCount
    }
  });
}

export async function skipConfirmation() {
  const s = getState();
  const map = s.paperMap;
  update((st) => { st.pendingPaperId = ''; });
  pushMessage(message('user', '先不核对，直接给我看结果。'));
  pushAssistant(
    `${map ? `这是这份卷子暴露的问题：\n\n${map}\n\n` : ''}核对记录先留在这里，你随时可以再上传一份新的卷子。`,
    { kind: 'paperMap' }
  );
}

/* ---------------- 图谱 ---------------- */

export async function showReport(withPaper = false) {
  const s = getState();
  const key = s.activeSubject;
  const meta = getSubjectMeta(key);
  const rows = s.kpMastery.filter((r) => rowSubjectKey(r) === key);
  if (!rows.length) {
    pushAssistant(
      meta?.ready
        ? `你的${meta.name}知识图谱还是空的。\n\n上传一份${meta.name}试卷、核对完之后，这里就会长出来。`
        : `「${subjectLabel(key)}」的数据接口已经预留，但还没有导入知识点白名单，所以还没有图谱。\n\n当前可用的学科是**高中数学**。`,
      { kind: 'empty' }
    );
    return;
  }
  let report;
  update((st) => { report = wfGenReport(st, withPaper ? st.lastPaperId : '', { subjectKey: key }); });
  pushAssistant(report.reportText, {
    kind: 'report',
    payload: {
      kpCount: report.kpCount, weakCount: report.weakCount, avgMastery: report.avgMastery,
      weakTop: report.weakTop, subjectName: report.subjectName
    }
  });
}

/* ---------------- AI 解析核对文本（可选增强） ---------------- */

async function parseConfirmationWithAI(text, s) {
  const ai = s.settings.ai;
  if (!aiConfigured(ai)) return null;
  try {
    const reply = await chatText(ai, [
      { role: 'system', content: '把学生对试卷核对四问的回答解析成 JSON，只输出 JSON，不要解释。' },
      {
        role: 'user',
        content: `可用题号：${s.chat.find((m) => m.kind === 'confirm')?.payload?.allList || '未知'}
学生的话：${text}
输出格式：{"missed_wrong":"","extra_wrong":"","calc_error":"","lucky_guess":"","blank_no_idea":"","blank_no_time":""}
只填学生明确指认的题号，用、分隔；没提到的留空字符串。`
      }
    ], { temperature: 0, timeoutMs: 30000 });
    const obj = extractJson(reply);
    const params = {};
    ['missed_wrong', 'extra_wrong', 'calc_error', 'lucky_guess', 'blank_no_idea', 'blank_no_time'].forEach((k) => {
      params[k] = obj[k] ? String(obj[k]) : '';
    });
    return Object.values(params).some(Boolean) ? params : null;
  } catch (e) {
    return null;
  }
}

/* ---------------- 主入口 ---------------- */

export async function handleUserMessage(text, images = []) {
  const clean = String(text || '').trim();
  const s0 = getState();

  pushMessage(message('user', clean || `上传了 ${images.length} 张试卷照片`, { imageCount: images.length }));

  if (images.length) return handleImages(images);
  if (!clean) return;

  // 1) 有图之外，pending 优先：这条消息是在回答核对
  if (s0.pendingPaperId) {
    const parsed = parseConfirmation(clean);
    if (parsed.skip) return skipConfirmation();
    if (parsed.recognized) {
      return runSettlement({ paper_id: s0.pendingPaperId, ...parsed.params });
    }
    const aiParsed = await parseConfirmationWithAI(clean, s0);
    if (aiParsed) return runSettlement({ paper_id: s0.pendingPaperId, ...aiParsed });

    const cardMsg = s0.chat.slice().reverse().find((m) => m.kind === 'confirm');
    const all = cardMsg?.payload?.allList || '';
    pushNote(
      `我还没听出具体题号。\n\n当前待核对的是「${s0.papers.find((p) => p.paper_id === s0.pendingPaperId)?.title || '这份卷子'}」。\n可用题号：${all || '见四问卡'}\n\n可以这样回答：\n· 「计算失误：2-5、2-13」\n· 「蒙对：2-22」\n· 「空题不会：2-14；没时间：2-20」\n· 或直接在上面的四问卡里勾选。`
    );
    return;
  }

  // 2) 未建档
  if (!s0.profile) {
    const info = parseProfileText(clean);
    if (info.grade && info.region && info.textbook) {
      return submitProfile(info);
    }
    pushAssistant(
      '收到。先告诉我三件事，我才能把知识点标准：\n\n**年级**（高一 / 高二 / 高三 / 初一 / 初二 / 初三）· **所在省市** · **用的哪版教材**（人教版 / 苏教版 / 北师大版 / 沪教版）\n\n一次说完就行，例如：高二，江苏南京，人教版。',
      { kind: 'profileAsk' }
    );
    return;
  }

  const activeMeta = getSubjectMeta(s0.activeSubject);
  if (!activeMeta?.ready) {
    pushNote(
      `「${subjectLabel(s0.activeSubject)}」的数据接口已经预留，但还没有导入知识点白名单。\n\n当前可用的学科是**高中数学**，可以在左侧学科选择器里切换。\n\n接入新学科的方法见 \`docs/SUBJECTS.md\`。`,
      { kind: 'empty' }
    );
    return;
  }

  // 3) 图谱 / 报告意图
  if (/看.*图谱|知识图谱|我的漏洞|薄弱|掌握得怎么样|学情报告|学得怎么样|分析一下我/.test(clean)) {
    return showReport();
  }
  if (/上次.*报告|历史报告|进步|退步|曲线/.test(clean)) {
    const reports = s0.reports.filter((r) => rowSubjectKey(r) === s0.activeSubject);
    if (reports.length) {
      const r = reports[0];
      pushAssistant(`这是最近一次保存的图谱快照（${r.created_at}）：\n\n${r.report_text}`, {
        kind: 'report',
        payload: { kpCount: r.kp_count, weakCount: r.weak_count, avgMastery: r.avg_mastery, weakTop: r.weak_top }
      });
      pushNote('想看所有历史快照，去「报告」页；想看现在的实时状态，说「看我的图谱」。');
    } else {
      pushNote('还没有存过历史报告。先上传一份试卷、核对完，就会生成第一份。');
    }
    return;
  }

  // 4) 上传引导
  if (/上传|发.*卷|试卷照片|怎么发|拍.*卷/.test(clean)) {
    pushNote('点输入框左边的图片按钮，把试卷照片发给我。\n\n建议一页一张、拍正、题干和手写答案都清晰。多页可以一起选。');
    return;
  }

  // 5) 一般对话
  const ai = s0.settings.ai;
  if (aiConfigured(ai)) {
    try {
      const reply = await groundedReply(ai, clean, contextText(s0));
      pushAssistant(reply, { kind: 'ai' });
      return;
    } catch (e) {
      pushNote(`AI 暂时连不上（${e.message}），我先用本地数据回答：\n\n${fallbackReply(clean, s0)}`);
      return;
    }
  }
  pushAssistant(fallbackReply(clean, s0), { kind: 'local' });
}

export { loadDemo };
