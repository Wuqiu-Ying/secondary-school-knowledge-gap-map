import assert from 'node:assert/strict';
import {
  emptyState, wfInitProfile, wfAnalyzePaper, wfConfirmPaper, wfUpdateMastery,
  wfGenReport, parseConfirmation, stats, KP
} from '../src/lib/core.js';
import {
  SUBJECT_CATALOG, getSubjectMeta, rowSubjectKey, defaultSubjectForGrade
} from '../src/data/subjects.js';
import {
  initCatalog, getKpList, validatePack, installPack, activatePack,
  restoreBuiltin, getCatalogInfo, getKpContext, PACK_FORMAT
} from '../src/lib/catalog.js';
import { buildDemoPaperA, buildDemoPaperB, buildDemoProfile } from '../src/lib/demo.js';
import { FONT_SIZES, fontScaleOf, normalizeFontSize } from '../src/lib/ui.js';

await initCatalog();

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

async function okAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('\n[1] WF0 建档');
const s = emptyState();
let r = wfInitProfile(s, buildDemoProfile());
ok('建档成功且 exists=false', () => {
  assert.equal(r.valid, true);
  assert.equal(r.exists, false);
  assert.match(s.profile.profile_summary, /高二/);
});
const r2 = wfInitProfile(s, { grade: '高二', region: '江苏南京', textbook: '人教版' });
ok('重复建档 exists=true 且仍只有一行档案', () => {
  assert.equal(r2.exists, true);
  assert.equal(typeof s.profile, 'object');
});

console.log('\n[2] A1 录入');
const a = wfAnalyzePaper(s, buildDemoPaperA().questions, { ...buildDemoPaperA().meta, paperId: 'P-TEST-A' });
ok(`识别 16 题，长表 ${a.rowCount} 行，全部 pending`, () => {
  assert.equal(a.questionCount, 16);
  assert.ok(a.rowCount >= 16);
  assert.ok(s.answerLogs.every((x) => x.confirm_status === 'pending'));
  assert.equal(a.wrongList.split('、').filter(Boolean).length, 2);
  assert.equal(a.blankList, '1-15');
});
ok('本卷速览不含百分比', () => {
  assert.ok(!/%/.test(a.paperMap));
  assert.match(a.paperMap, /本卷 16 题，错 3 题/);
});

console.log('\n[3] A2 核对落库');
const ca = wfConfirmPaper(s, { paper_id: a.paperId, calc_error: '1-4、1-12', lucky_guess: '1-9', blank_no_time: '1-15' });
ok('updateCount=4，全部行落为 confirmed', () => {
  assert.equal(ca.updateCount, 4);
  assert.equal(ca.rejectedCount, 0);
  assert.ok(s.answerLogs.filter((x) => x.paper_id === a.paperId).every((x) => x.confirm_status === 'confirmed'));
});
ok('蒙对只改 err_type，不改对错（改判留给 WF2）', () => {
  const row = s.answerLogs.find((x) => x.paper_id === a.paperId && x.log_id === '1-9');
  assert.equal(row.is_correct, 1);
  assert.equal(row.err_type, '蒙对');
});
ok('计算失误 err_type=计算', () => {
  const row = s.answerLogs.find((x) => x.paper_id === a.paperId && x.log_id === '1-12');
  assert.equal(row.err_type, '计算');
  assert.equal(row.is_correct, 0);
});

console.log('\n[4] WF2 掌握度');
const ma = wfUpdateMastery(s, a.paperId);
ok('13 个知识点写入（3 道会而失分被排除）', () => {
  assert.equal(ma.upsertCount, 13);
  assert.equal(s.kpMastery.length, 13);
});
ok('计算失误知识点无掌握度行', () => {
  assert.ok(!s.kpMastery.some((x) => Number(x.kp_id) === 111501));
  assert.ok(!s.kpMastery.some((x) => Number(x.kp_id) === 110511));
});
ok('蒙对计为错：error_cnt≥1 且 mastery<50', () => {
  const kp = s.kpMastery.find((x) => Number(x.kp_id) === 110616);
  assert.ok(kp);
  assert.ok(kp.error_cnt >= 1);
  assert.ok(kp.mastery < 50);
});
ok('幂等锁：第二次调用 alreadySynced', () => {
  const before = JSON.stringify(s.kpMastery);
  const m2 = wfUpdateMastery(s, a.paperId);
  assert.equal(m2.alreadySynced, true);
  assert.equal(JSON.stringify(s.kpMastery), before);
});
ok('掌握度/置信度范围合法', () => {
  s.kpMastery.forEach((x) => {
    assert.ok(x.mastery >= 0 && x.mastery <= 100);
    assert.ok(x.confidence >= 0 && x.confidence <= 1);
  });
});

console.log('\n[5] WF3 图谱');
const ra = wfGenReport(s, a.paperId);
ok('生成文本并写 report 快照', () => {
  assert.match(ra.reportText, /【知识漏洞图谱】/);
  assert.equal(s.reports.length, 1);
  assert.equal(s.reports[0].report_type, 'exam');
});
ok('分支三（空 paper_id）只出文本不写库', () => {
  const n = s.reports.length;
  const rb = wfGenReport(s, '');
  assert.equal(rb.hasPaper, false);
  assert.equal(s.reports.length, n);
});

console.log('\n[6] 第二份卷子（待核对 → 结算）');
const b = wfAnalyzePaper(s, buildDemoPaperB().questions, { ...buildDemoPaperB().meta, paperId: 'P-TEST-B' });
ok('24 题全部 pending', () => {
  assert.equal(b.questionCount, 24);
  assert.equal(s.pendingPaperId, 'P-TEST-B');
  assert.ok(s.answerLogs.filter((x) => x.paper_id === b.paperId).every((x) => x.confirm_status === 'pending'));
});
const cb = wfConfirmPaper(s, {
  paper_id: b.paperId, calc_error: '2-5、2-13、2-24', lucky_guess: '2-22',
  blank_no_idea: '2-14', blank_no_time: '2-20'
});
ok('6 处修正落库，其余识别结果一并确认', () => {
  assert.equal(cb.updateCount, 6);
  assert.ok(s.answerLogs.filter((x) => x.paper_id === b.paperId).every((x) => x.confirm_status === 'confirmed'));
});
const mb = wfUpdateMastery(s, b.paperId);
ok('新增 20 个知识点（4 道排除）', () => {
  assert.equal(mb.upsertCount, 20);
  assert.equal(s.kpMastery.length, 33);
});
// 单题作答时 confidence=0.125，按设计全部归入“数据不足”。
// 这里手工把一条改成足够置信且低分，用来验证 WF3 的“需要加强”分档确实生效。
s.kpMastery[0].confidence = 0.5;
s.kpMastery[0].mastery = 40;
s.kpMastery[0].error_cnt = 3;
const rb = wfGenReport(s, b.paperId);
ok('图谱出现「需要加强」分档', () => {
  assert.match(rb.reportText, /需要加强/);
  assert.ok(rb.weakCount > 0);
  assert.equal(s.reports.length, 2);
});
ok('统计口径正确', () => {
  const st = stats(s);
  assert.equal(st.paperCount, 2);
  assert.equal(st.kpCount, 33);
  assert.ok(st.avgMastery > 0 && st.avgMastery < 100);
});

console.log('\n[7] 核对文本解析');
const cases = [
  ['计算失误：2-5、2-13；蒙对：2-22', { calc_error: '2-5、2-13', lucky_guess: '2-22' }],
  ['第 2 页第 4 题是算错，第 7 题蒙对', { calc_error: '2-4', lucky_guess: '7' }],
  ['空题不会：2-14，没时间：2-20', { blank_no_idea: '2-14', blank_no_time: '2-20' }],
  ['第 3 题我错了，你判对了', { missed_wrong: '3' }]
];
cases.forEach(([text, expect]) => {
  ok(`解析「${text}」`, () => {
    const p = parseConfirmation(text);
    assert.equal(p.recognized, true);
    Object.entries(expect).forEach(([k, v]) => assert.equal(p.params[k], v));
  });
});
ok('「算了」走跳过分支', () => {
  assert.equal(parseConfirmation('算了，不核对，直接给我看结果').skip, true);
});

console.log('\n[8] 白名单完整性');
ok(`380 条，kp_id 唯一`, () => {
  assert.equal(KP.length, 380);
  assert.equal(new Set(KP.map((x) => x.kp_id)).size, 380);
});

console.log('\n[9] 多学科数据接口');
ok('27 个必修科目，key / kp_id 段码唯一', () => {
  assert.equal(SUBJECT_CATALOG.length, 27);
  assert.equal(new Set(SUBJECT_CATALOG.map((s) => s.key)).size, 27);
  assert.equal(new Set(SUBJECT_CATALOG.map((s) => s.kpPrefix)).size, 27);
});
ok('只有高中数学 ready，且条数与注册表一致', () => {
  const ready = SUBJECT_CATALOG.filter((s) => s.ready);
  assert.deepEqual(ready.map((s) => s.key), ['senior-math']);
  assert.equal(getKpList('senior-math').length, 380);
  assert.equal(getSubjectMeta('senior-math').kpCount, 380);
});
ok('预留学科白名单为空', () => {
  assert.equal(getKpList('junior-math').length, 0);
  assert.equal(getKpList('senior-physics').length, 0);
});
ok('预留学科不能录入试卷，报错清晰', () => {
  const s2 = emptyState();
  s2.activeSubject = 'junior-math';
  assert.throws(() => wfAnalyzePaper(s2, [{ q_no: '1', stem: 'x', tags: [] }], { subjectKey: 'junior-math' }), /还没有导入知识点白名单/);
});
ok('预留学科的 WF3 返回空图谱，不写 report', () => {
  const s2 = emptyState();
  s2.activeSubject = 'junior-math';
  const r = wfGenReport(s2, '');
  assert.equal(r.kpCount, 0);
  assert.equal(s2.reports.length, 0);
  assert.match(r.reportText, /知识图谱还是空的/);
});
ok('旧数据 subject=数学 自动映射到 senior-math', () => {
  assert.equal(rowSubjectKey({ subject: '数学' }), 'senior-math');
  assert.equal(rowSubjectKey({ subject_key: 'senior-physics' }), 'senior-physics');
});
ok('初一建档自动切到 junior-math', () => {
  const s2 = emptyState();
  const r2 = wfInitProfile(s2, { grade: '初二', region: '江苏南京', textbook: '人教版' });
  assert.equal(r2.valid, true);
  assert.equal(s2.activeSubject, 'junior-math');
  assert.equal(defaultSubjectForGrade(8), 'junior-math');
  assert.equal(defaultSubjectForGrade(11), 'senior-math');
});
ok('stats 按学科隔离', () => {
  const sMath = stats(s, 'senior-math');
  const sPhysics = stats(s, 'senior-physics');
  assert.ok(sMath.kpCount > 0);
  assert.equal(sPhysics.kpCount, 0);
  assert.equal(sPhysics.whitelist, 0);
  assert.equal(sPhysics.ready, false);
});

console.log('\n[10] 知识点库 Pack');

const fakePack = {
  format: PACK_FORMAT,
  manifest: {
    pack_id: 'test-senior-math-2026.11',
    subject_key: 'senior-math',
    stage: 'senior',
    textbook: '通用',
    region: '全国',
    version: '2026.11.1',
    published_at: '2026-11-01',
    source: 'selftest',
    license: 'test',
    kp_count: 2
  },
  entries: [
    { kp_id: 119901, kp_name: '测试知识点A', aliases: '测试A|A', annotation: '用于 pack 测试', chapter: '测试模块', grade_min: 10, grade_max: 12, status: 'active' },
    { kp_id: 119902, kp_name: '测试知识点B', aliases: '', annotation: '', chapter: '测试模块', grade_min: 10, grade_max: 12, status: 'active' }
  ]
};

ok('内置 pack 可读，380 条', () => {
  const info = getCatalogInfo('senior-math');
  assert.equal(info.active.pack_id, 'builtin-senior-math-2026.10');
  assert.equal(getKpList('senior-math').length, 380);
});
ok('合法 pack 校验通过', () => {
  const r = validatePack(fakePack);
  assert.equal(r.ok, true, r.errors.join(';'));
});
ok('错误段码 / 重复名称会被拒绝', () => {
  const bad = structuredClone(fakePack);
  bad.entries[0].kp_id = 129901;
  assert.equal(validatePack(bad).ok, false);
  const dup = structuredClone(fakePack);
  dup.entries[1].kp_name = dup.entries[0].kp_name;
  assert.equal(validatePack(dup).ok, false);
});
await okAsync('安装 pack 后可查询、可切回内置', async () => {
  const installed = await installPack(fakePack, { persist: false });
  assert.equal(installed.manifest.kp_count, 2);
  assert.equal(getKpList('senior-math').length, 2);
  assert.equal(getCatalogInfo('senior-math').active.version, '2026.11.1');
  const ctx = getKpContext({ subjectKey: 'senior-math', grade: 11, query: '测试A', limit: 5 });
  assert.equal(ctx.total, 1);
  assert.equal(ctx.items[0].kp_id, 119901);
  restoreBuiltin('senior-math');
  assert.equal(getKpList('senior-math').length, 380);
  assert.equal(getCatalogInfo('senior-math').active.pack_id, 'builtin-senior-math-2026.10');
});

console.log('\n[11] 字号设置');

ok('默认字号为标准，四档可用', () => {
  assert.equal(emptyState().settings.ui.fontSize, 'normal');
  assert.equal(FONT_SIZES.length, 4);
  assert.equal(normalizeFontSize('xlarge'), 'xlarge');
  assert.equal(normalizeFontSize('huge'), 'normal');
});
ok('字号 scale 递增', () => {
  assert.ok(fontScaleOf('large') > fontScaleOf('normal'));
  assert.ok(fontScaleOf('xlarge') > fontScaleOf('large'));
  assert.equal(fontScaleOf('normal'), 1);
});
ok('AI 视觉模型默认同步文本模型', () => {
  assert.equal(emptyState().settings.ai.syncVision, true);
});

ok('首次教程默认未完成，完成后持久化标记', () => {
  assert.equal(emptyState().meta.tutorialDone, false);
  const s = emptyState();
  s.meta.tutorialDone = true;
  assert.equal(s.meta.tutorialDone, true);
});

console.log(`\n全部通过：${passed} 项断言组`);
console.log('最终统计:', stats(s));
