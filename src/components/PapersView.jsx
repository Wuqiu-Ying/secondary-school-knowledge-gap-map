import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import SubjectSelect from './SubjectSelect.jsx';
import { getKp } from '../lib/core.js';
import { getSubjectMeta, rowSubjectKey, subjectLabel } from '../data/subjects.js';
import { setActiveSubject } from '../lib/store.js';

const TYPE_LABEL = { choice: '选择', blank: '填空', solution: '解答' };

function statusOf(group) {
  const pending = group.rows.some((r) => r.confirm_status === 'pending');
  return pending ? 'pending' : 'confirmed';
}

export default function PapersView({ state, setView }) {
  const key = state.activeSubject;
  const meta = getSubjectMeta(key);
  const ready = !!meta?.ready;
  const papers = state.papers.filter((p) => rowSubjectKey(p) === key);
  const [selectedId, setSelectedId] = useState(papers[0]?.paper_id || '');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState('');

  const paper = papers.find((p) => p.paper_id === selectedId) || papers[0];

  const groups = useMemo(() => {
    if (!paper) return [];
    const logs = state.answerLogs.filter((l) => l.paper_id === paper.paper_id);
    const map = new Map();
    logs.forEach((l) => {
      const k = String(l.log_id);
      if (!map.has(k)) {
        map.set(k, {
          log_id: k, stem: l.question_text, user_answer: l.user_answer, correct_answer: l.correct_answer,
          q_type: l.q_type, is_correct: l.is_correct, err_type: l.err_type, confirm_status: l.confirm_status,
          ocr_uncertain: l.ocr_uncertain, rows: [], kps: [], notes: []
        });
      }
      const g = map.get(k);
      g.rows.push(l);
      if (l.kp_id > 0) {
        g.kps.push(l.kp_name);
        if (l.tag_note) g.notes.push(l.tag_note);
      }
    });
    return [...map.values()];
  }, [state.answerLogs, paper]);

  const shown = groups.filter((g) => {
    if (filter === 'wrong') return !g.is_correct;
    if (filter === 'blank') return !String(g.user_answer || '').trim();
    if (filter === 'pending') return statusOf(g) === 'pending';
    return true;
  });

  if (!papers.length) {
    return (
      <div className="page">
        <header className="view-head">
          <div><h1>试卷档案 <span className="subject-inline">· {subjectLabel(key)}</span></h1><p>每道题的识别结果与核对记录，都在这里。</p></div>
          <div className="head-actions"><SubjectSelect value={key} tone="light" compact /></div>
        </header>
        <div className="empty-panel">
          <div className="empty-mark">卷</div>
          <h2>{ready ? `还没有${meta?.name}试卷` : `${subjectLabel(key)} 的数据接口已预留`}</h2>
          <p>{ready ? '上传一份试卷，或者先载入演示档案看看完整流程。' : '该学科还没有导入知识点白名单，暂时不会有试卷记录。'}</p>
          {ready ? (
            <button className="primary-btn" onClick={() => setView('chat')}>去对话 <Icon name="arrow" size={16} /></button>
          ) : (
            <button className="primary-btn" onClick={() => setActiveSubject('senior-math')}>切到高中数学 <Icon name="arrow" size={16} /></button>
          )}
        </div>
      </div>
    );
  }

  const wrongCount = groups.filter((g) => !g.is_correct).length;
  const blankCount = groups.filter((g) => !String(g.user_answer || '').trim()).length;
  const confirmedCount = groups.filter((g) => statusOf(g) === 'confirmed').length;

  return (
    <div className="page">
      <header className="view-head">
        <div><h1>试卷档案 <span className="subject-inline">· {subjectLabel(key)}</span></h1><p>长表按题聚合展示：一题多个知识点也只算一道题。</p></div>
        <div className="head-actions">
          <SubjectSelect value={key} tone="light" compact />
          <span className="head-count">{papers.length} 份试卷</span>
        </div>
      </header>

      <div className="papers-layout">
        <aside className="paper-list" data-tour="papers-list">
          {papers.map((p) => (
            <button key={p.paper_id} className={`paper-item ${paper?.paper_id === p.paper_id ? 'active' : ''}`} onClick={() => { setSelectedId(p.paper_id); setExpanded(''); }}>
              <div className="paper-item-top">
                <span className="paper-item-title">{p.title}</span>
                <span className={`tag ${p.mastery_synced ? 'green' : 'gold'}`}>{p.mastery_synced ? '已同步' : '待核对'}</span>
              </div>
              <div className="paper-item-meta">{p.exam_date} · {p.question_cnt} 题 · {p.exam_type}</div>
            </button>
          ))}
        </aside>

        <div className="paper-detail">
          <div className="paper-head">
            <div>
              <h2>{paper.title}</h2>
              <div className="paper-meta">{paper.exam_date} · {paper.exam_type} · 上传于 {paper.created_at?.slice(0, 16)}</div>
            </div>
            <div className="paper-kpis">
              <div><b>{groups.length}</b><span>题</span></div>
              <div><b className="red-text">{wrongCount}</b><span>错</span></div>
              <div><b>{blankCount}</b><span>空</span></div>
              <div><b className="green-text">{confirmedCount}</b><span>已确认</span></div>
            </div>
          </div>

          {paper.paper_map && (
            <details className="paper-map-block">
              <summary>本卷速览</summary>
              <pre>{paper.paper_map}</pre>
            </details>
          )}

          <div className="filter-row">
            {[['all', '全部'], ['wrong', '错题'], ['blank', '空题'], ['pending', '待核对']].map(([k, l]) => (
              <button key={k} className={`filter-btn ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
            {groups.some((g) => statusOf(g) === 'pending') && (
              <button className="text-btn ml-auto" onClick={() => setView('chat')}>去对话完成核对 <Icon name="arrow" size={14} /></button>
            )}
          </div>

          <div className="q-list">
            {shown.map((g) => {
              const open = expanded === g.log_id;
              return (
                <div className={`q-row ${open ? 'open' : ''}`} key={g.log_id}>
                  <button className="q-summary" onClick={() => setExpanded(open ? '' : g.log_id)}>
                    <span className="q-no">{g.log_id}</span>
                    <span className={`q-dot ${!g.is_correct ? 'wrong' : 'right'}`}>{g.is_correct ? '✓' : '×'}</span>
                    <span className="q-stem">{g.stem || '（题干缺失）'}</span>
                    <span className="q-kp">{g.kps[0] || '未归类'}</span>
                    {g.ocr_uncertain ? <span className="tag gray">存疑</span> : null}
                    <span className={`tag ${g.err_type ? 'red' : 'line'}`}>{g.err_type || '—'}</span>
                    <span className={`tag ${statusOf(g) === 'confirmed' ? 'green' : 'gold'}`}>{statusOf(g) === 'confirmed' ? '已确认' : '待核对'}</span>
                    <Icon name="chevron" size={14} className={open ? 'rot90' : ''} />
                  </button>
                  {open && (
                    <div className="q-detail">
                      <div className="q-cols">
                        <div><span>学生作答</span><p>{g.user_answer || '（空白）'}</p></div>
                        <div><span>正确答案</span><p>{g.correct_answer || '—'}</p></div>
                        <div><span>题型 / 知识点</span><p>{TYPE_LABEL[g.q_type] || g.q_type} · {g.kps.join('、') || '未归类'}</p></div>
                      </div>
                      {g.notes.length > 0 && <div className="q-note">标注说明：{g.notes.join('；')}</div>}
                      <div className="q-ids">log_id = {g.log_id} · 共 {g.rows.length} 行（一题多知识点）</div>
                    </div>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && <div className="panel-empty">这个筛选下没有题目。</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
