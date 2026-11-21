import React from 'react';
import Icon from './Icon.jsx';
import { stats } from '../lib/core.js';
import { update } from '../lib/store.js';
import { subjectLabel } from '../data/subjects.js';
import { FONT_SIZES, normalizeFontSize, fontSizeLabel, APP_VERSION } from '../lib/ui.js';

export default function MeView({ state, setView, notify, onOpenTutorial }) {
  const st = stats(state);
  const profile = state.profile || {};
  const current = normalizeFontSize(state.settings?.ui?.fontSize);

  const setFont = (key, label) => {
    update((s) => {
      s.settings.ui = { ...(s.settings.ui || {}), fontSize: key };
    });
    notify?.(`字号已切换为「${label}」`);
  };

  const openSettings = () => setView('settings');

  return (
    <div className="page me-page">
      <header className="view-head me-head">
        <div>
          <h1>我的</h1>
          <p>档案、阅读字号与本地数据，都在这里。</p>
        </div>
        <button className="icon-btn gear-btn" data-tour="me-gear" onClick={openSettings} aria-label="打开设置" title="设置">
          <Icon name="settings" size={20} />
        </button>
      </header>

      <section className="panel me-profile">
        <div className="me-avatar">{(profile.nickname || '同').slice(0, 1)}</div>
        <div className="me-info">
          <h2>{profile.nickname || '未命名同学'}</h2>
          <p>{profile.grade_label || '—'} · {profile.region_name || '—'} · {profile.textbook_edition || '—'}</p>
          <span className="tag green">{subjectLabel(state.activeSubject)}</span>
        </div>
        <div className="me-stats">
          <div><b>{st.paperCount}</b><span>份试卷</span></div>
          <div><b>{st.kpCount}</b><span>个知识点</span></div>
          <div><b>{st.avgMastery}</b><span>平均掌握度</span></div>
        </div>
      </section>

      <section className="panel me-font-card" data-tour="me-font">
        <div className="settings-head">
          <div className="settings-icon"><Icon name="book" size={18} /></div>
          <div>
            <h3>阅读字号</h3>
            <p>调大后整个界面的文字一起放大；选择会保存在本机。</p>
          </div>
          <span className="tag line">当前：{fontSizeLabel(current)}</span>
        </div>

        <div className="font-options">
          {FONT_SIZES.map((f) => (
            <button
              key={f.key}
              className={`font-option ${current === f.key ? 'active' : ''}`}
              onClick={() => setFont(f.key, f.label)}
              aria-pressed={current === f.key}
            >
              <b style={{ fontSize: `${13 * f.scale}px` }}>A</b>
              <span>{f.label}</span>
              <em>{f.hint}</em>
            </button>
          ))}
        </div>

        <div className="font-preview">
          <div className="preview-label">预览</div>
          <p>函数在某点可导，意味着曲线在该点有切线；导数就是这条切线的斜率。</p>
          <p className="muted">识别到的题干、错题清单和报告都会跟着放大。</p>
        </div>
      </section>

      <section className="panel me-links">
        <button className="me-link" onClick={onOpenTutorial}>
          <span className="me-link-icon"><Icon name="spark" size={18} /></span>
          <span className="me-link-main"><b>新手教程</b><em>5 步了解建档、传卷、四问核对、图谱与设置</em></span>
          <Icon name="chevron" size={16} />
        </button>
        <button className="me-link" onClick={openSettings}>
          <span className="me-link-icon"><Icon name="key" size={18} /></span>
          <span className="me-link-main"><b>设置</b><em>档案、AI 接口、知识点库、数据备份</em></span>
          <Icon name="chevron" size={16} />
        </button>
        <button className="me-link" onClick={openSettings}>
          <span className="me-link-icon"><Icon name="download" size={18} /></span>
          <span className="me-link-main"><b>数据备份</b><em>导出 / 导入 JSON，或清空本机数据</em></span>
          <Icon name="chevron" size={16} />
        </button>
        <button className="me-link" onClick={openSettings}>
          <span className="me-link-icon"><Icon name="book" size={18} /></span>
          <span className="me-link-main"><b>知识点库版本</b><em>查看当前 Pack，导入更新包</em></span>
          <Icon name="chevron" size={16} />
        </button>
      </section>

      <div className="me-foot">
        <span>中学知识漏洞图谱 v{APP_VERSION} · 单机版</span>
        <span>离线可用 · 数据只存本机</span>
      </div>
    </div>
  );
}
