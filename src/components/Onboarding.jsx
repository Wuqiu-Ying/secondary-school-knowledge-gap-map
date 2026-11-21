import React, { useState } from 'react';
import Icon from './Icon.jsx';
import { submitProfile } from '../lib/agent.js';
import { loadDemo, importState } from '../lib/store.js';

const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];
const BOOKS = ['人教版', '苏教版', '北师大版', '沪教版', '湘教版'];

export default function Onboarding() {
  const [grade, setGrade] = useState('');
  const [region, setRegion] = useState('');
  const [book, setBook] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const start = async () => {
    if (!grade) { setErr('请选择年级'); return; }
    if (!region.trim()) { setErr('请填写所在省市'); return; }
    if (!book) { setErr('请选择教材版本'); return; }
    setBusy(true);
    const r = await submitProfile({ grade, region, book, textbook: book, nickname });
    setBusy(false);
    if (!r.valid) setErr(r.err_msg);
  };

  const onImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      importState(await f.text());
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div className="onboarding">
      <div className="ob-left">
        <div className="ob-brand">
          <div className="brand-mark light">
            <span className="brand-seal">图</span>
          </div>
          <span>中学知识漏洞图谱</span>
        </div>

        <div className="ob-copy">
          <div className="ob-kicker">中学 · 知识漏洞诊断</div>
          <h1>看清漏洞，<br />而不是制造焦虑。</h1>
          <p>上传试卷、核对四问、更新掌握度。它只做分析，不催促、不打扰、不替你决定该练什么。</p>
          <div className="ob-features">
            <div><Icon name="target" size={18} /> <span>四问核对，先收数据后给结论</span></div>
            <div><Icon name="graph" size={18} /> <span>按知识模块长出的漏洞图谱</span></div>
            <div><Icon name="clock" size={18} /> <span>Elo + 遗忘衰减，掌握度会随时间修正</span></div>
          </div>
        </div>

        <div className="ob-orbit" aria-hidden="true">
          <svg viewBox="0 0 420 420" width="100%" height="100%">
            <circle cx="210" cy="210" r="150" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="1" />
            <circle cx="210" cy="210" r="110" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
            <circle cx="210" cy="210" r="70" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1" />
            <path d="M128 286 L208 190 L318 238 L252 340 Z" fill="none" stroke="rgba(201,164,92,.35)" strokeWidth="1.2" />
            <path d="M208 190 L252 340" fill="none" stroke="rgba(201,164,92,.16)" strokeWidth="1" />
            {[['128','286','#c9a45c'],['208','190','#6ea8a2'],['318','238','#c8553d'],['252','340','#8b93a8']].map(([x,y,c],i)=>(
              <g key={i}><circle cx={x} cy={y} r="5" fill={c} /><circle cx={x} cy={y} r="12" fill="none" stroke={c} strokeOpacity=".35" /></g>
            ))}
            <circle cx="210" cy="210" r="9" fill="#ece4d2" />
          </svg>
        </div>

        <div className="ob-foot">全部数据保存在本机 · 可随时导出备份 · 预留 AI 接口</div>
      </div>

      <div className="ob-right">
        <div className="ob-card">
          <div className="ob-step">开始使用 · 建档</div>
          <h2>先认识一下你</h2>
          <p className="ob-desc">这三件事决定知识点的范围与颗粒度。以后升学、换教材时可以随时更新。</p>

          <label className="field-label">年级</label>
          <div className="chip-row grades">
            {GRADES.map((g) => (
              <button key={g} className={`choice ${grade === g ? 'selected' : ''}`} onClick={() => setGrade(g)}>{g}</button>
            ))}
          </div>

          <label className="field-label">所在省市</label>
          <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="填写所在省市" />

          <label className="field-label">教材版本</label>
          <div className="chip-row wrap">
            {BOOKS.map((b) => (
              <button key={b} className={`choice ${book === b ? 'selected' : ''}`} onClick={() => setBook(b)}>{b}</button>
            ))}
          </div>

          <label className="field-label">昵称 <span className="optional">选填</span></label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="怎么称呼你" />

          {err && <div className="form-error">{err}</div>}

          <button className="primary-btn full" onClick={start} disabled={busy}>
            {busy ? '正在建档…' : '开始使用'} <Icon name="arrow" size={17} />
          </button>

          <div className="ob-divider"><span>或者</span></div>

          <button className="ghost-btn full" onClick={() => loadDemo()}>
            <Icon name="spark" size={17} /> 载入演示档案，先看看效果
          </button>

          <label className="link-btn">
            <Icon name="upload" size={14} /> 导入之前的备份
            <input type="file" accept="application/json" hidden onChange={onImport} />
          </label>

          <div className="ob-note">
            演示档案包含一位高二学生的历史卷与待核对模拟卷，可完整体验四问核对流程。
            <br />
            已接入：高中数学 380 个知识点；初中 / 高中其他必修科目的数据接口已预留。
          </div>
        </div>
      </div>
    </div>
  );
}
