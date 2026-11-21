import { getKpList, findKp as getKp } from './catalog.js';
import { getSubjectMeta, DEFAULT_SUBJECT_KEY } from '../data/subjects.js';

export const AI_PRESETS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    visionModel: 'deepseek-flash',
    syncVision: true,
    note: 'DeepSeek Flash 同一模型支持文本和图片；Key 在 platform.deepseek.com 创建'
  },
  qwen: {
    label: '阿里云百炼 · 通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    visionModel: 'qwen3-vl-plus',
    syncVision: false,
    note: '旧版通用域名仍可用；新账号也可填控制台里的业务空间专属域名'
  },
  zhipu: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3',
    visionModel: 'glm-5.3-flash',
    syncVision: false,
    note: 'GLM-5.3 文本，GLM-5.3-Flash 原生多模态'
  },
  moonshot: {
    label: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3.1-pro',
    visionModel: 'kimi-k3.1-pro',
    syncVision: true,
    note: 'Kimi K3.1 Pro 原生支持视觉，可文本/图片同模型'
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
    syncVision: true,
    note: '模型名以账号可用列表为准；任何 OpenAI Chat Completions 兼容服务也可手填'
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    visionModel: 'openai/gpt-4o-mini',
    syncVision: true,
    note: '聚合平台；模型 ID 形如 openai/gpt-4o-mini，按控制台可用列表选择'
  },
  ollama: {
    label: 'Ollama（本机）',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5vl:7b',
    visionModel: 'qwen2.5vl:7b',
    syncVision: true,
    note: '本地模型；API Key 随便填一个非空值（如 ollama），先在终端 ollama pull qwen2.5vl:7b'
  },
  custom: {
    label: '自定义',
    baseUrl: '',
    model: '',
    visionModel: '',
    syncVision: false,
    note: '填写兼容 /chat/completions 的地址和模型名'
  }
};

export function aiConfigured(ai) {
  return !!(ai && ai.enabled && ai.baseUrl && ai.model && ai.apiKey);
}

export function visionConfigured(ai) {
  return !!(ai && ai.enabled && ai.baseUrl && ai.visionModel && ai.apiKey);
}

function endpoint(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
}

async function callAI(ai, payload, timeoutMs = 180000) {
  if (!aiConfigured(ai)) throw new Error('还没有配置 AI 接口（设置 → AI 接口）');

  // Electron 主进程代理，绕过浏览器 CORS
  if (window.xqDesktop?.aiChat) {
    const res = await window.xqDesktop.aiChat({ url: endpoint(ai.baseUrl), apiKey: ai.apiKey, payload });
    if (!res.ok) throw new Error(res.error || 'AI 请求失败');
    return res.data;
  }

  // Capacitor Android：走原生 HTTP，绕过 WebView 的 CORS
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { CapacitorHttp } = await import('@capacitor/core');
      const res = await CapacitorHttp.post({
        url: endpoint(ai.baseUrl),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
        data: payload,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      if (res.status < 200 || res.status >= 300) {
        const detail = typeof res.data === 'string' ? res.data.slice(0, 300) : JSON.stringify(res.data).slice(0, 300);
        throw new Error(`AI 接口返回 ${res.status}：${detail}`);
      }
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('AI 接口返回')) throw e;
      throw new Error('移动端 AI 请求失败：' + (e.message || e));
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(endpoint(ai.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    const text = await resp.text();
    if (!resp.ok) {
      let detail = text.slice(0, 400);
      try {
        const j = JSON.parse(text);
        detail = j.error?.message || j.message || detail;
      } catch (_) {}
      throw new Error(`AI 接口返回 ${resp.status}：${detail}`);
    }
    return JSON.parse(text);
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI 请求超时，请检查网络或稍后重试');
    if (e instanceof TypeError && /fetch/i.test(e.message)) {
      throw new Error('无法连接 AI 接口。浏览器直连可能被 CORS 拦截，请用桌面版，或确认接口允许跨域。');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function contentOf(data) {
  return data?.choices?.[0]?.message?.content ?? '';
}

export async function chatText(ai, messages, opts = {}) {
  const payload = {
    model: ai.model,
    messages,
    temperature: opts.temperature ?? ai.temperature ?? 0.2,
    stream: false
  };
  const data = await callAI(ai, payload, opts.timeoutMs);
  const content = contentOf(data);
  if (!content) throw new Error('AI 返回了空内容');
  return content;
}

export function extractJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const a1 = t.indexOf('[');
  const b1 = t.lastIndexOf(']');
  if (a1 >= 0 && b1 > a1) {
    try { return JSON.parse(t.slice(a1, b1 + 1)); } catch (_) {}
  }
  const a2 = t.indexOf('{');
  const b2 = t.lastIndexOf('}');
  if (a2 >= 0 && b2 > a2) {
    try { return JSON.parse(t.slice(a2, b2 + 1)); } catch (_) {}
  }
  throw new Error('AI 返回的不是合法 JSON：' + t.slice(0, 160));
}

/* ---------------- 视觉识别（对应 A1 的 ③） ---------------- */

const OCR_SYSTEM = `你是试卷数字化助手。你会收到若干张试卷照片，请把它们当作同一份试卷的连续页面处理。
逐题提取信息，只输出 JSON 数组，不要任何解释文字，不要用 markdown 代码块包裹。`;

function ocrPrompt(n, subjectMeta) {
  const subject = subjectMeta?.name || '数学';
  const stage = subjectMeta?.stage === 'junior' ? '初中' : '高中';
  return `这是同一份${stage}${subject}试卷的连续页面照片，共 ${n} 张。

请按顺序识别全部题目。

输出格式：
[
  {
    "q_no": "题号（带图序前缀，见规则 1）",
    "q_type": "choice | blank | solution",
    "stem": "题干，超过 500 字则截断",
    "user_answer": "学生的作答内容；若为空白填 \\"\\"",
    "correct_answer": "正确答案",
    "is_correct": 0 或 1,
    "score_rate": 0 到 1 之间的小数,
    "full_score": 该题满分,
    "difficulty": 1 到 5 的整数,
    "ocr_uncertain": true 或 false
  }
]

规则：
1. q_no 必须带图序前缀，保证整个输出里唯一。格式「图序-题号」，例如第 2 张图第 3 题写 "2-3"。即使只有一张图也要带前缀。多张图片可能是不同作业，严禁重新连续编号。
2. 题干或学生答案看不清时，ocr_uncertain 填 true。宁可标不确定，也不要猜。猜错比不判更糟。
3. score_rate 只依据对错判断，不要猜分值：选择/填空全对 1、错 0；多小问解答题 = 做对小问数 ÷ 总小问数。
4. 空白题：user_answer 填 ""，is_correct 填 0。
5. 满分与难度按${stage}${subject}范围判断，不要照抄卷首总分。
6. q_type：选择题 choice，填空题 blank，解答题 solution。
7. 没有收到图片就输出 []，不要推测。
8. correct_answer 必须是正确答案本身，由你独立解出；不要写「与学生作答一致」「见解析」。
9. 选择题答案写成「选项字母 + 选项内容」，例如 "C. x₁=2，x₂=-2"。
10. user_answer 只填学生写的内容，不要加评语。
11. 解答题先独立解出正确答案再比对；不确定时 is_correct=0 且 ocr_uncertain=true。`;
}

export async function ocrPaper(ai, imageUrls, subjectMeta) {
  if (!visionConfigured(ai)) throw new Error('还没有配置视觉模型（设置 → AI 接口 → 视觉模型）');
  const userContent = [
    { type: 'text', text: ocrPrompt(imageUrls.length, subjectMeta) },
    ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } }))
  ];
  const payload = {
    model: ai.visionModel,
    messages: [
      { role: 'system', content: OCR_SYSTEM },
      { role: 'user', content: userContent }
    ],
    temperature: 0.1,
    stream: false
  };
  const data = await callAI(ai, payload, 300000);
  const raw = contentOf(data);
  const list = extractJson(raw);
  if (!Array.isArray(list) || list.length === 0) throw new Error('没有识别到任何题目，请确认图片是试卷正文且足够清晰');
  return list;
}

/* ---------------- 本地候选择优（对应 ⑥⑦） ---------------- */

function ngrams(s, n = 2) {
  const t = String(s || '').replace(/[\s，。、；：（）()【】\[\]·,.;:]/g, '');
  const set = new Set();
  for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n));
  return set;
}

export function localCandidates(stem, subjectKey = DEFAULT_SUBJECT_KEY, top = 15) {
  const text = String(stem || '');
  const qset = ngrams(text);
  const scored = [];
  for (const kp of getKpList(subjectKey)) {
    if (kp.status !== 'active') continue;
    let score = 0;
    const names = [kp.kp_name, ...String(kp.aliases || '').split('|')].filter(Boolean);
    for (const nm of names) {
      if (nm.length >= 2 && text.includes(nm)) score += 12 + nm.length;
    }
    if (kp.annotation && text.includes(kp.annotation.slice(0, 6))) score += 3;
    const kset = ngrams(`${kp.kp_name}${kp.aliases || ''}${kp.annotation || ''}`);
    let inter = 0;
    kset.forEach((g) => { if (qset.has(g)) inter += 1; });
    score += Math.min(8, inter * 0.6);
    if (score > 0) scored.push({ kp, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, top).map((x) => x.kp);
}

export function localTagQuestion(stem, subjectKey = DEFAULT_SUBJECT_KEY) {
  const cands = localCandidates(stem, subjectKey, 3);
  if (!cands.length) return [];
  return [{ kp_id: cands[0].kp_id, role: 'primary', tag_note: '' }];
}

/* ---------------- 打 Tag（对应 ⑧） ---------------- */

const TAG_SYSTEM = `你是中学知识点标注器。你会收到题目与候选知识点列表。
只输出 JSON 数组，不要解释文字。只能使用候选列表里的 kp_id，禁止造词。`;

export async function tagQuestions(ai, questions, candidatesById) {
  const payloadQuestions = questions.map((q) => ({
    q_no: q.q_no,
    stem: q.stem,
    candidates: (candidatesById[q.q_no] || []).map((c) => ({ kp_id: c.kp_id, kp_name: c.kp_name, chapter: c.chapter }))
  }));
  const prompt = `【知识点打 Tag 规则】
对每道题：
1. 从候选列表选 1–5 个最贴切的知识点。第一个是 primary，其余 secondary。
2. 只能使用候选里出现的 kp_id，禁止造词。
3. 都不贴切就输出空 tags（表示 unmapped），不要勉强。
4. 章节为「解题方法与技巧」的 Tag 每题最多 1 个。
5. 可写一句 ≤60 字的 tag_note，说不清就留空。
6. 近义候选选更上位的那个。

题目与候选：
${JSON.stringify(payloadQuestions)}

输出：
[{"q_no":"1","tags":[{"kp_id":110101,"role":"primary","tag_note":""}]}]`;

  const text = await chatText(ai, [
    { role: 'system', content: TAG_SYSTEM },
    { role: 'user', content: prompt }
  ], { temperature: 0.1, timeoutMs: 180000 });
  const list = extractJson(text);
  const map = {};
  (Array.isArray(list) ? list : []).forEach((t) => {
    if (!t || t.q_no === undefined) return;
    map[String(t.q_no)] = Array.isArray(t.tags) ? t.tags : [];
  });
  return map;
}

export async function buildAIQuestions(ai, imageUrls, opts = {}) {
  const options = typeof opts === 'function' ? { onProgress: opts } : opts;
  const onProgress = options.onProgress;
  const subjectKey = options.subjectKey || DEFAULT_SUBJECT_KEY;
  const subjectMeta = getSubjectMeta(subjectKey);
  if (!subjectMeta) throw new Error(`未知学科: ${subjectKey}`);
  if (!getKpList(subjectKey).length) {
    throw new Error(`「${subjectMeta.name}」还没有导入知识点白名单，暂时不能识别试卷。`);
  }

  onProgress?.(`正在识别${subjectMeta.name}试卷（视觉模型）…`);
  const raw = await ocrPaper(ai, imageUrls, subjectMeta);
  onProgress?.(`识别到 ${raw.length} 道题，正在匹配知识点…`);

  const questions = raw.map((q, i) => ({
    q_no: String(q.q_no || i + 1),
    q_type: ['choice', 'blank', 'solution'].includes(q.q_type) ? q.q_type : 'solution',
    stem: String(q.stem || '').slice(0, 500),
    user_answer: String(q.user_answer || '').slice(0, 300),
    correct_answer: String(q.correct_answer || '').slice(0, 300),
    is_correct: q.is_correct ? 1 : 0,
    score_rate: Number(q.score_rate ?? 0),
    full_score: Number(q.full_score ?? 0),
    difficulty: Number(q.difficulty ?? 3),
    ocr_uncertain: !!q.ocr_uncertain,
    tags: []
  }));

  const candidatesById = {};
  questions.forEach((q) => { candidatesById[q.q_no] = localCandidates(q.stem, subjectKey, 15); });

  let tagMap = {};
  try {
    tagMap = await tagQuestions(ai, questions, candidatesById);
  } catch (e) {
    console.warn('AI 打 Tag 失败，改用本地匹配', e);
    onProgress?.('AI 打 Tag 失败，已改用本地白名单匹配');
  }

  questions.forEach((q) => {
    const valid = (tagMap[q.q_no] || []).filter((t) => getKp(t.kp_id, subjectKey));
    q.tags = valid.length
      ? valid.map((t) => ({ kp_id: Number(t.kp_id), role: t.role === 'secondary' ? 'secondary' : 'primary', note: String(t.tag_note || '').slice(0, 60) }))
      : localTagQuestion(q.stem, subjectKey);
  });

  return questions;
}

/* ---------------- 通用对话（人设的数据约束） ---------------- */

export async function groundedReply(ai, userText, context) {
  const system = `你是「中学知识漏洞图谱」的知识漏洞分析助手，帮中学生看清知识漏洞。
产品边界：只分析，不督促学习、不主动提醒复习、不做学习计划。
铁律：数据只能来自下面提供的真实状态；查不到就直说「我还没有你的数据」，严禁推测或编造。
不要提「工作流」「接口」「数据库」这类词。回答简洁，中文，可用少量 Markdown。
若学生问图谱/薄弱点，提醒他可以说「看我的图谱」由系统生成完整图谱。
不要输出任何得分率/正确率/百分比，用「错题 N 题」这种可数表述。

当前学生状态：
${context}`;
  return chatText(ai, [
    { role: 'system', content: system },
    { role: 'user', content: userText }
  ], { temperature: 0.5, timeoutMs: 90000 });
}

export async function testAIConnection(ai) {
  const t0 = performance.now();
  const text = await chatText(ai, [
    { role: 'system', content: '你是连通性测试助手。' },
    { role: 'user', content: '只回复两个字：正常' }
  ], { temperature: 0, timeoutMs: 30000 });
  return { ok: true, ms: Math.round(performance.now() - t0), reply: text.trim().slice(0, 40) };
}
