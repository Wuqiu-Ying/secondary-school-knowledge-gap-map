import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Markdown from './Markdown.jsx';
import SubjectSelect from './SubjectSelect.jsx';
import { getSubjectMeta, rowSubjectKey, subjectLabel } from '../data/subjects.js';
import { setActiveSubject } from '../lib/store.js';
import { fontScaleOf } from '../lib/ui.js';

function Trend({ reports, fontScale = 1 }) {
  const data = useMemo(() => reports.slice().reverse(), [reports]);
  if (data.length < 2) {
    return <div className="trend-empty">再来一次核对，这里会出现掌握度变化曲线。</div>;
  }
  const W = 560, H = 180, P = 34;
  const vals = data.map((r) => Number(r.avg_mastery || 0));
  const min = Math.max(0, Math.min(...vals) - 8);
  const max = Math.min(100, Math.max(...vals) + 8);
  const span = Math.max(1, max - min);
  const pts = data.map((r, i) => {
    const x = P + (i * (W - P * 2)) / (data.length - 1);
    const y = H - P - ((Number(r.avg_mastery) - min) / span) * (H - P * 2);
    return { x, y, r };
  });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg">
      {[0, 0.5, 1].map((f) => {
        const y = P + f * (H - P * 2);
        return <line key={f} x1={P} x2={W - P} y1={y} y2={y} stroke="#e7dfcf" strokeDasharray="3 5" />;
      })}
      <path d={path} fill="none" stroke="#2f6f6b" strokeWidth="2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fbf8f0" stroke="#2f6f6b" strokeWidth="2" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={9.5 * fontScale} fill="#6d675a">{p.r.avg_mastery}</text>
        </g>
      ))}
      {pts.map((p, i) => (
        <text key={`t${i}`} x={p.x} y={H - 12} textAnchor="middle" fontSize={9 * fontScale} fill="#9a9384">
          {String(p.r.created_at || '').slice(5, 10)}
        </text>
      ))}
    </svg>
  );
}

export default function ReportsView({ state, setView }) {
  const fontScale = fontScaleOf(state.settings?.ui?.fontSize);
  const key = state.activeSubject;
  const meta = getSubjectMeta(key);
  const ready = !!meta?.ready;
  const reports = state.reports.filter((r) => rowSubjectKey(r) === key);
  const [selectedId, setSelectedId] = useState(reports[0]?.report_id || '');
  const report = reports.find((r) => r.report_id === selectedId) || reports[0];
  const weak = (report?.weak_top || '').split('、').filter(Boolean);

  if (!reports.length) {
    return (
      <div className="page">
        <header className="view-head">
          <div><h1>报告 <span className="subject-inline">· {subjectLabel(key)}</span></h1><p>每次核对后自动留一份快照，按时间倒序就是进步轨迹。</p></div>
          <div className="head-actions"><SubjectSelect value={key} tone="light" compact /></div>
        </header>
        <div className="empty-panel">
          <div className="empty-mark">报</div>
          <h2>{ready ? `还没有${meta?.name}报告快照` : `${subjectLabel(key)} 的数据接口已预留`}</h2>
          <p>{ready ? '完成一份试卷的核对后，图谱会自动存档。也可以直接看当前实时图谱。' : '该学科还没有导入知识点白名单，暂时不会有报告。'}</p>
          {ready ? (
            <div className="empty-actions">
              <button className="primary-btn" onClick={() => setView('chat')}>去核对试卷 <Icon name="arrow" size={16} /></button>
              <button className="ghost-btn" onClick={() => setView('graph')}>看实时图谱</button>
            </div>
          ) : (
            <button className="primary-btn" onClick={() => setActiveSubject('senior-math')}>切到高中数学 <Icon name="arrow" size={16} /></button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="view-head">
        <div><h1>报告 <span className="subject-inline">· {subjectLabel(key)}</span></h1><p>只记录真实数据。没有得分率，只有可数的错题数与掌握度。</p></div>
        <div className="head-actions">
          <SubjectSelect value={key} tone="light" compact />
          <span className="head-count">{reports.length} 份快照</span>
        </div>
      </header>

      <div className="reports-layout">
        <aside className="report-list">
          {reports.map((r) => (
            <button key={r.report_id} className={`report-item ${report?.report_id === r.report_id ? 'active' : ''}`} onClick={() => setSelectedId(r.report_id)}>
              <div className="report-item-date">{String(r.created_at || '').slice(0, 16)}</div>
              <div className="report-item-title">{r.report_type === 'exam' ? '试卷触发' : '随时快照'} · 平均 {r.avg_mastery}</div>
              <div className="report-item-meta">{r.kp_count} 个知识点 · {r.weak_count} 个需加强</div>
            </button>
          ))}
        </aside>

        <div className="report-detail">
          <div className="panel trend-panel" data-tour="reports-trend">
            <div className="panel-head">
              <div className="panel-title">平均掌握度变化</div>
              <div className="panel-sub">只统计置信度 ≥ 30% 的知识点</div>
            </div>
            <Trend reports={reports} fontScale={fontScale} />
          </div>

          <div className="panel report-text-panel">
            <div className="report-head">
              <div>
                <div className="report-kicker">{report.report_type === 'exam' ? '试卷报告' : '实时快照'}</div>
                <h2>{String(report.created_at || '').slice(0, 16)}</h2>
              </div>
              <div className="report-kpis">
                <div><b>{report.kp_count}</b><span>知识点</span></div>
                <div><b className="red-text">{report.weak_count}</b><span>需加强</span></div>
                <div><b>{report.avg_mastery}</b><span>平均掌握</span></div>
              </div>
            </div>
            {weak.length > 0 && (
              <div className="weak-top">
                <span>最薄弱</span>
                {weak.map((w) => <i key={w}>{w}</i>)}
              </div>
            )}
            <Markdown text={report.report_text} className="report-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
