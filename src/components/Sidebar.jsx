import React from 'react';
import Icon from './Icon.jsx';
import SubjectSelect from './SubjectSelect.jsx';
import { stats } from '../lib/core.js';
import { getSubjectMeta } from '../data/subjects.js';

const NAV = [
  { id: 'chat', label: '对话', icon: 'chat', hint: '识别 · 核对 · 结算' },
  { id: 'graph', label: '知识图谱', icon: 'graph', hint: '漏洞 · 掌握度' },
  { id: 'papers', label: '试卷档案', icon: 'paper', hint: '题目 · 作答明细' },
  { id: 'reports', label: '报告', icon: 'report', hint: '快照 · 变化' }
];

export default function Sidebar({ view, setView, state }) {
  const st = stats(state);
  const ai = state.settings.ai;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <span className="brand-seal">图</span>
        </div>
        <div>
          <div className="brand-name">中学知识漏洞图谱</div>
          <div className="brand-sub">KNOWLEDGE GAP MAP</div>
        </div>
      </div>

      <div className="subject-picker">
        <div className="subject-picker-label">当前学科</div>
        <SubjectSelect value={state.activeSubject} />
        <div className="subject-picker-state">
          {getSubjectMeta(state.activeSubject)?.ready ? '数据接口已接入' : '接口已预留 · 待导入白名单'}
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">主视图</div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
            <Icon name={n.icon} size={19} />
            <span className="nav-text">
              <span className="nav-title">{n.label}</span>
              <span className="nav-hint">{n.hint}</span>
            </span>
            {n.id === 'graph' && st.weakCount > 0 && <span className="nav-badge">{st.weakCount}</span>}
          </button>
        ))}
        <div className="nav-label nav-label-spaced">系统</div>
        <button className={`nav-item ${view === 'me' || view === 'settings' ? 'active' : ''}`} onClick={() => setView('me')}>
          <Icon name="user" size={19} />
          <span className="nav-text">
            <span className="nav-title">我的</span>
            <span className="nav-hint">档案 · 字号 · 数据</span>
          </span>
        </button>
      </nav>

      <div className="sidebar-foot">
        <div className="profile-card" onClick={() => setView('me')} role="button" tabIndex={0}>
          <div className="avatar">{(state.profile.nickname || '同学').slice(0, 1)}</div>
          <div className="profile-meta">
            <div className="profile-name">{state.profile.nickname || '未命名同学'}</div>
            <div className="profile-sub">{state.profile.grade_label} · {state.profile.region_name}</div>
          </div>
          <Icon name="chevron" size={15} />
        </div>
        <div className={`ai-chip ${ai.enabled ? 'on' : ''}`}>
          <span className="dot" />
          <span>{ai.enabled ? `AI 已接入 · ${ai.model || '未选模型'}` : '离线模式 · 数据在本地'}</span>
        </div>
      </div>
    </aside>
  );
}
