import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import SubjectSelect from './SubjectSelect.jsx';
import HelpTip from './HelpTip.jsx';
import { AI_PRESETS, testAIConnection } from '../lib/ai.js';
import { wfInitProfile } from '../lib/core.js';
import { update, exportState, importState, resetAll, loadDemo, setActiveSubject } from '../lib/store.js';
import { SUBJECT_CATALOG, STAGES } from '../data/subjects.js';
import { APP_VERSION, GITHUB_URL } from '../lib/ui.js';
import {
  getCatalogInfo, installPack, activatePack, restoreBuiltin, exportActivePack, subscribeCatalog
} from '../lib/catalog.js';

const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];
const BOOKS = ['人教版', '苏教版', '北师大版', '沪教版', '湘教版'];

function Toggle({ on, onChange }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><span /></button>;
}

export default function SettingsView({ state, notify, onBack }) {
  const [profile, setProfile] = useState({
    nickname: state.profile?.nickname || '',
    grade: state.profile?.grade_label || '高二',
    region: state.profile?.region_name || '',
    book: state.profile?.textbook_edition || '人教版'
  });
  const [ai, setAi] = useState({ ...state.settings.ai });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [catalogTick, setCatalogTick] = useState(0);
  const [packMsg, setPackMsg] = useState(null);
  const packFileRef = useRef(null);

  const catalog = useMemo(
    () => getCatalogInfo(state.activeSubject),
    [state.activeSubject, catalogTick]
  );

  useEffect(() => subscribeCatalog(() => setCatalogTick((n) => n + 1)), []);

  useEffect(() => {
    setAi({ ...state.settings.ai });
  }, [state.settings.ai]);

  const saveProfile = () => {
    let res;
    update((s) => { res = wfInitProfile(s, { ...profile, textbook: profile.book, region: profile.region }); });
    if (res.valid) notify('档案已更新：' + res.profile_summary);
    else notify(res.err_msg);
  };

  const saveAI = () => {
    update((s) => { s.settings.ai = { ...ai }; });
    notify(ai.enabled ? 'AI 接口已保存' : '已切换为离线模式');
  };

  const applyPreset = (key) => {
    const p = AI_PRESETS[key];
    setAi((prev) => {
      const model = p.model || prev.model;
      const syncVision = p.syncVision !== false;
      return {
        ...prev, provider: key,
        baseUrl: p.baseUrl || prev.baseUrl,
        model,
        syncVision,
        visionModel: syncVision ? model : (p.visionModel || prev.visionModel)
      };
    });
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testAIConnection({ ...ai, enabled: true });
      setTestResult({ ok: true, text: `连接正常 · ${r.ms}ms · 回复「${r.reply}」` });
    } catch (e) {
      setTestResult({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  const onImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      importState(await f.text());
      notify('备份已导入');
    } catch (ex) {
      notify('导入失败：' + ex.message);
    }
  };

  const onPackFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPackMsg(null);
    try {
      const pack = JSON.parse(await f.text());
      const installed = await installPack(pack, { persist: true, activate: true });
      setPackMsg({ ok: true, text: `已安装并激活 ${installed.manifest.version}（${installed.entries.length} 个知识点）` });
      notify('知识点包已更新');
    } catch (ex) {
      setPackMsg({ ok: false, text: ex.message });
    }
  };

  const onExportPack = () => {
    try {
      const text = exportActivePack(state.activeSubject);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kp-${state.activeSubject}-${catalog.active?.version || 'pack'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (ex) {
      setPackMsg({ ok: false, text: ex.message });
    }
  };

  const onActivatePack = (packId) => {
    try {
      const p = activatePack(packId);
      setPackMsg({ ok: true, text: `已切换到 ${p.manifest.version}` });
      notify('知识点库版本已切换');
    } catch (ex) {
      setPackMsg({ ok: false, text: ex.message });
    }
  };

  const onRestoreBuiltin = () => {
    if (!window.confirm('恢复到内置知识点包？当前安装的更新包不会被删除，可以随时再切回来。')) return;
    try {
      const p = restoreBuiltin(state.activeSubject);
      setPackMsg({ ok: true, text: `已恢复内置版本 ${p.manifest.version}` });
      notify('已恢复内置知识点库');
    } catch (ex) {
      setPackMsg({ ok: false, text: ex.message });
    }
  };

  const doReset = () => {
    if (!window.confirm('确定要清空全部数据吗？档案、试卷、掌握度、报告都会删除，且不可撤销。建议先导出备份。')) return;
    resetAll();
  };

  const copyGithub = async () => {
    try {
      await navigator.clipboard.writeText(GITHUB_URL);
      notify('GitHub 链接已复制');
      return;
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = GITHUB_URL;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      notify('GitHub 链接已复制');
    } catch (_) {
      notify('复制失败，请手动选择链接复制');
    }
  };

  const aiOn = ai.enabled;

  return (
    <div className="page settings-page">
      <header className="view-head settings-page-head">
        <div className="head-left">
          {onBack && (
            <button className="icon-btn back-btn" onClick={onBack} aria-label="返回我的" title="返回我的">
              <Icon name="arrow" size={18} />
            </button>
          )}
          <div><h1>设置</h1><p>档案、学科数据接口、AI 与本地数据。所有配置只保存在这台设备上。</p></div>
        </div>
        <div className="head-actions"><SubjectSelect value={state.activeSubject} tone="light" compact /></div>
      </header>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="book" size={18} /></div>
            <div><h3>学生档案</h3><p>年级、地区、教材版本决定知识点范围。</p></div>
          </div>
          <div className="form-row two">
            <div>
              <label className="field-label">昵称</label>
              <input className="input" value={profile.nickname} onChange={(e) => setProfile({ ...profile, nickname: e.target.value })} />
            </div>
            <div>
              <label className="field-label">年级</label>
              <div className="chip-row grades">
                {GRADES.map((g) => (
                  <button key={g} className={`choice sm ${profile.grade === g ? 'selected' : ''}`} onClick={() => setProfile({ ...profile, grade: g })}>{g}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-row two">
            <div>
              <label className="field-label">所在省市</label>
              <input className="input" value={profile.region} onChange={(e) => setProfile({ ...profile, region: e.target.value })} />
            </div>
            <div>
              <label className="field-label">教材版本</label>
              <select className="input" value={profile.book} onChange={(e) => setProfile({ ...profile, book: e.target.value })}>
                {BOOKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="settings-actions">
            <button className="primary-btn" onClick={saveProfile}>保存档案</button>
          </div>
        </section>

        <section className="panel settings-card subject-card">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="graph" size={18} /></div>
            <div>
              <h3>学科数据接口</h3>
              <p>初中 / 高中所有必修科目都已注册；每个学科独立白名单、章节、Tag、掌握度与报告。</p>
            </div>
            <span className="tag green">当前：{SUBJECT_CATALOG.find((s) => s.key === state.activeSubject)?.stage === 'junior' ? '初中' : '高中'}{SUBJECT_CATALOG.find((s) => s.key === state.activeSubject)?.name}</span>
          </div>

          <div className="subject-registry">
            {Object.values(STAGES).map((stage) => (
              <div className="subject-stage" key={stage.key}>
                <div className="subject-stage-title">{stage.label}</div>
                <div className="subject-grid">
                  {SUBJECT_CATALOG.filter((s) => s.stage === stage.key).map((s) => (
                    <button
                      key={s.key}
                      className={`subject-item ${s.ready ? 'ready' : 'reserved'} ${state.activeSubject === s.key ? 'active' : ''}`}
                      onClick={() => setActiveSubject(s.key)}
                      title={s.description}
                    >
                      <span className="subject-name">{s.name}</span>
                      <span className={`tag ${s.ready ? 'green' : 'gray'}`}>{s.ready ? `${s.kpCount} 个知识点` : '待接入'}</span>
                      <span className="subject-prefix">段码 {s.kpPrefix}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="ai-tip">
            <Icon name="spark" size={14} />
            <span>当前只有高中数学导入了 380 条白名单；其余科目点击后会进入「接口已预留」状态。新增数据只需把 xlsx 转成 <code>src/data/kp/&lt;subject-key&gt;.js</code> 并注册，工作流无需改动。</span>
          </div>
        </section>

        <section className="panel settings-card catalog-card" data-tour="settings-catalog">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="download" size={18} /></div>
            <div>
              <h3>知识点库版本</h3>
              <p>内置 baseline + 可导入的 update pack。更新包只写入本机 IndexedDB，不上传、不联网。</p>
            </div>
            <span className="tag green">{catalog.active ? `v${catalog.active.version}` : '无'}</span>
          </div>

          <div className="catalog-meta">
            <div>
              <span>当前包</span>
              <b>{catalog.active?.pack_id || '—'}</b>
              <em>{catalog.active ? `${catalog.active.kp_count} 个知识点 · ${catalog.active.chapter_count} 个模块` : '该学科暂无数据'}</em>
            </div>
            <div>
              <span>来源 / 发布时间</span>
              <b>{catalog.active?.source || '—'}</b>
              <em>{catalog.active?.published_at || '—'} · 校验 {String(catalog.active?.checksum || '').slice(0, 8) || '—'}</em>
            </div>
          </div>

          <div className="settings-actions wrap">
            <label className="ghost-btn file-btn">
              <Icon name="upload" size={15} /> 导入更新包
              <input ref={packFileRef} type="file" accept="application/json,.json" hidden onChange={onPackFile} />
            </label>
            <button className="ghost-btn" onClick={onExportPack} disabled={!catalog.active}>
              <Icon name="download" size={15} /> 导出当前包
            </button>
            <button
              className="ghost-btn"
              onClick={onRestoreBuiltin}
              disabled={!catalog.active || catalog.active.pack_id === catalog.builtinId}
            >
              <Icon name="reset" size={15} /> 恢复内置版本
            </button>
          </div>

          {packMsg && <div className={`test-result ${packMsg.ok ? 'ok' : 'bad'}`}>{packMsg.ok ? '✓ ' : '× '}{packMsg.text}</div>}

          <div className="catalog-list">
            {catalog.installed.map((p) => (
              <div className={`catalog-row ${p.active ? 'active' : ''}`} key={p.pack_id}>
                <div className="catalog-row-main">
                  <b>{p.version}</b>
                  <span>{p.kp_count} 条 · {p.source || '未知来源'} · {p.published_at || '—'}</span>
                </div>
                <span className={`tag ${p.active ? 'green' : p.builtin ? 'line' : 'gold'}`}>
                  {p.active ? '使用中' : p.builtin ? '内置' : '已安装'}
                </span>
                {!p.active && (
                  <button className="text-btn" onClick={() => onActivatePack(p.pack_id)}>切换</button>
                )}
              </div>
            ))}
          </div>

          <div className="ai-tip">
            <Icon name="spark" size={14} />
            <span>
              包格式 <code>xq-kp-pack/v1</code>：manifest（学科/版本/段码/来源/校验和）+ entries。
              导入时会校验 kp_id 段码、重复、别名、checksum；更新包不覆盖内置包，可随时回滚。
            </span>
          </div>
        </section>

        <section className="panel settings-card ai-card" data-tour="settings-ai">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="key" size={18} /></div>
            <div><h3>AI 接口</h3><p>可挂载任意 OpenAI Chat Completions 兼容服务；不配置也能离线走完整流程。</p></div>
            <div className="settings-toggle"><Toggle on={aiOn} onChange={(v) => setAi({ ...ai, enabled: v })} /></div>
          </div>

          <div className="ai-grid">
            <div>
              <div className="label-with-help">
                <label className="field-label">服务预设</label>
                <button type="button" className="text-btn mini" onClick={() => applyPreset(ai.provider)}>套用当前预设</button>
              </div>
              <select className="input" value={ai.provider} onChange={(e) => applyPreset(e.target.value)}>
                {Object.entries(AI_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Base URL</label>
              <input className="input" value={ai.baseUrl} onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" />
            </div>
            <div>
              <div className="label-with-help">
                <label className="field-label">API Key</label>
                <HelpTip text="在服务商控制台创建，通常以 sk- 开头。只保存在本机 localStorage，不会上传到我们的服务器；但如果多人共用电脑，建议用完清除。" />
              </div>
              <input className="input mono" type="password" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} placeholder="sk-…" autoComplete="off" />
            </div>
            <div>
              <div className="label-with-help">
                <label className="field-label">文本模型</label>
                <HelpTip text="用于对话、四问解析、生成报告。选服务商的通用对话模型，必须兼容 OpenAI Chat Completions（/chat/completions）。" />
              </div>
              <input
                className="input mono"
                value={ai.model}
                onChange={(e) => {
                  const model = e.target.value;
                  setAi((prev) => ({
                    ...prev,
                    model,
                    ...(prev.syncVision !== false ? { visionModel: model } : {})
                  }));
                }}
                placeholder="deepseek-flash"
              />
            </div>
            <div>
              <div className="label-with-help">
                <label className="field-label">视觉模型 <span className="optional">试卷识别用</span></label>
                <HelpTip text="用于试卷照片 OCR/识别。本应用没有本地 OCR，图片会直接发到这个视觉模型；留空则只能走演示卷或手工录入。DeepSeek Flash、Kimi K3 等同一模型也可填这里。" />
              </div>
              <div className="sync-vision">
                <span>同步文本模型</span>
                <Toggle
                  on={ai.syncVision !== false}
                  onChange={(v) => setAi((prev) => ({ ...prev, syncVision: v, ...(v ? { visionModel: prev.model } : {}) }))}
                />
              </div>
              <input
                className={`input mono ${ai.syncVision !== false ? 'synced' : ''}`}
                value={ai.syncVision !== false ? ai.model : ai.visionModel}
                onChange={(e) => setAi({ ...ai, visionModel: e.target.value })}
                disabled={ai.syncVision !== false}
                placeholder="缺省可与文本模型相同"
              />
            </div>
            <div>
              <label className="field-label">温度</label>
              <input className="input" type="number" min="0" max="1" step="0.1" value={ai.temperature} onChange={(e) => setAi({ ...ai, temperature: Number(e.target.value) })} />
            </div>
          </div>

          <div className="ai-tip">
            <Icon name="spark" size={14} />
            <span>{AI_PRESETS[ai.provider]?.note || '兼容 /chat/completions 即可'}。浏览器直连可能被 CORS 拦截，桌面版通过主进程代理请求。</span>
          </div>

          {testResult && <div className={`test-result ${testResult.ok ? 'ok' : 'bad'}`}>{testResult.ok ? '✓ ' : '× '}{testResult.text}</div>}

          <div className="settings-actions">
            <button className="ghost-btn" onClick={test} disabled={testing || !ai.baseUrl || !ai.model || !ai.apiKey}>
              {testing ? '测试中…' : '测试连接'}
            </button>
            <button className="primary-btn" onClick={saveAI}>保存接口</button>
          </div>
          <div className="ai-warning">没有本地 OCR 组件：试卷识别会把图片发送到上面的视觉模型。DeepSeek Flash 等模型可同时处理文本和图片。Key 仅保存在本机 localStorage，不会上传到任何服务器；若多人共用电脑，建议用完清除。</div>
        </section>

        <section className="panel settings-card">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="download" size={18} /></div>
            <div><h3>数据</h3><p>单机存储，随时导出。换电脑或重装前先备份。</p></div>
          </div>
          <div className="data-stats">
            <div><b>{state.papers.length}</b><span>试卷</span></div>
            <div><b>{state.answerLogs.length}</b><span>答题行</span></div>
            <div><b>{state.kpMastery.length}</b><span>掌握度</span></div>
            <div><b>{state.reports.length}</b><span>报告</span></div>
          </div>
          <div className="settings-actions wrap">
            <button className="ghost-btn" onClick={exportState}><Icon name="download" size={15} /> 导出备份</button>
            <label className="ghost-btn file-btn"><Icon name="upload" size={15} /> 导入备份<input type="file" accept="application/json" hidden onChange={onImport} /></label>
            <button className="ghost-btn" onClick={() => { loadDemo(); notify('演示档案已载入'); }}><Icon name="spark" size={15} /> 载入演示</button>
            <button className="danger-btn" onClick={doReset}><Icon name="trash" size={15} /> 清空全部</button>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="desktop" size={18} /></div>
            <div><h3>封装与分发</h3><p>一套 Web 核心，桌面端 Electron，移动端 Capacitor。</p></div>
          </div>
          <div className="pack-list">
            <div className="pack-row">
              <div className="pack-icon"><Icon name="desktop" size={18} /></div>
              <div>
                <b>Windows .exe</b>
                <p>已配置 electron 主进程 + electron-builder（NSIS 安装包 / 免安装 portable）。</p>
                <code>npm run dist:win</code>
              </div>
              <span className="tag green">已就绪</span>
            </div>
            <div className="pack-row">
              <div className="pack-icon"><Icon name="phone" size={18} /></div>
              <div>
                <b>Android .apk</b>
                <p>Web 资源可直接由 Capacitor 承载；PWA manifest 已提供，可先“添加到主屏幕”。</p>
                <code>npm run build &amp;&amp; npx cap add android</code>
              </div>
              <span className="tag gold">待 Android SDK</span>
            </div>
            <div className="pack-row">
              <div className="pack-icon"><Icon name="graph" size={18} /></div>
              <div>
                <b>运行架构</b>
                <p>五条工作流全部在前端核心复现；数据落 IndexedDB/localStorage；AI 请求由主进程代理绕开 CORS。</p>
              </div>
              <span className="tag line">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        <section className="panel settings-card about-card">
          <div className="settings-head">
            <div className="settings-icon"><Icon name="spark" size={18} /></div>
            <div><h3>关于</h3></div>
          </div>
          <div className="about-copy about-simple">
            <p>这曾是一个比赛项目<br />可能会有一些问题<br />欢迎到GitHub反馈</p>
            <div className="about-link-row">
              <a className="about-link" href={GITHUB_URL} target="_blank" rel="noreferrer">{GITHUB_URL}</a>
              <button className="text-btn" type="button" onClick={copyGithub}>复制链接</button>
            </div>
            <p>版本号 {APP_VERSION}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
