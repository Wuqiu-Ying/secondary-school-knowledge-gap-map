import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import SubjectSelect from './SubjectSelect.jsx';
import { stats, weakKps, nowStr } from '../lib/core.js';
import { getSubjectMeta, rowSubjectKey, subjectLabel } from '../data/subjects.js';
import { setActiveSubject } from '../lib/store.js';
import { fontScaleOf } from '../lib/ui.js';

const COLORS = {
  weak: '#c8553d',
  mid: '#c9a45c',
  good: '#3f7f6f',
  thin: '#a8a294'
};

function colorOf(r) {
  if (Number(r.confidence) < 0.3) return COLORS.thin;
  if (Number(r.mastery) < 60) return COLORS.weak;
  if (Number(r.mastery) < 85) return COLORS.mid;
  return COLORS.good;
}

function statusLabel(s) {
  return { mastered: '掌握扎实', reviewing: '需要加强', learning: '学习中', new: '新知识点' }[s] || '学习中';
}

function levelLabel(r) {
  if (Number(r.confidence) < 0.3) return '数据不足';
  const m = Number(r.mastery);
  if (m >= 85) return '掌握扎实';
  if (m >= 60) return '掌握良好';
  return '需要加强';
}

function Constellation({ rows, selected, onSelect, fontScale = 1 }) {
  const W = 820, H = 560, CX = W / 2, CY = H / 2;

  const chapters = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const ch = r.chapter || '未分类';
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch).push(r);
    });
    return [...map.entries()].map(([name, items]) => ({
      name,
      items: items.slice().sort((a, b) => Number(a.mastery) - Number(b.mastery)),
      avg: items.reduce((s, r) => s + Number(r.mastery), 0) / items.length
    })).sort((a, b) => a.avg - b.avg);
  }, [rows]);

  const nodes = [];
  chapters.forEach((ch, i) => {
    const n = chapters.length;
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(1, n);
    const cx = CX + Math.cos(angle) * 225;
    const cy = CY + Math.sin(angle) * 165;
    ch.cx = cx; ch.cy = cy; ch.angle = angle;
    ch.items.forEach((r, j) => {
      const ring = Math.floor(j / 7);
      const rr = 16 + ring * 17 + (j % 2) * 4;
      const aa = j * 2.399 + i * 0.7;
      nodes.push({
        r,
        x: cx + Math.cos(aa) * rr,
        y: cy + Math.sin(aa) * rr * 0.82,
        color: colorOf(r),
        radius: 5 + Math.min(8, Number(r.attempt_cnt || 0) * 1.1)
      });
    });
  });

  return (
    <div className="constellation-wrap" data-tour="graph-canvas">
      <svg viewBox={`0 0 ${W} ${H}`} className="constellation" role="img" aria-label="知识漏洞图谱">
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbf7ed" />
            <stop offset="100%" stopColor="#f3efe4" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#bgGlow)" rx="18" />
        {[70, 130, 190, 250].map((r) => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#d9d1bf" strokeWidth="0.8" strokeDasharray="2 6" opacity="0.7" />
        ))}
        {chapters.map((ch, i) => (
          <line key={`l${i}`} x1={CX} y1={CY} x2={ch.cx} y2={ch.cy} stroke="#d9d1bf" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.55" />
        ))}

        <circle cx={CX} cy={CY} r="26" fill="#1c2434" />
        <text x={CX} y={CY + 5} textAnchor="middle" fill="#f6f1e4" fontSize={13 * fontScale} fontFamily="serif">图谱</text>

        {chapters.map((ch, i) => (
          <g key={ch.name}>
            <text
              x={ch.cx + Math.cos(ch.angle) * 54}
              y={ch.cy + Math.sin(ch.angle) * 44}
              textAnchor={Math.abs(Math.cos(ch.angle)) < 0.2 ? 'middle' : Math.cos(ch.angle) > 0 ? 'start' : 'end'}
              fill="#6d675a"
              fontSize={11.5 * fontScale}
              fontFamily="serif"
            >
              {ch.name.length > 9 ? ch.name.slice(0, 9) + '…' : ch.name}
            </text>
          </g>
        ))}

        {nodes.map(({ r, x, y, color, radius }, i) => (
          <g key={`${r.kp_id}-${i}`} className="node-g" onClick={() => onSelect(r)} style={{ cursor: 'pointer' }}>
            <title>{`${r.kp_name}｜掌握 ${r.mastery}｜作答 ${r.attempt_cnt} 次｜${levelLabel(r)}`}</title>
            {selected?.kp_id === r.kp_id && <circle cx={x} cy={y} r={radius + 7} fill="none" stroke="#1c2434" strokeWidth="1.4" strokeDasharray="3 3" />}
            <circle cx={x} cy={y} r={radius + 5} fill={color} opacity="0.13" />
            <circle
              cx={x} cy={y} r={radius} fill={color}
              opacity={Number(r.confidence) < 0.3 ? 0.45 : 0.9}
              stroke={Number(r.confidence) < 0.3 ? '#8f897b' : 'rgba(255,255,255,.7)'}
              strokeWidth="1.2"
              strokeDasharray={Number(r.confidence) < 0.3 ? '2 2' : '0'}
            />
          </g>
        ))}
      </svg>
      <div className="legend">
        <span><i style={{ background: COLORS.weak }} />需要加强</span>
        <span><i style={{ background: COLORS.mid }} />掌握良好</span>
        <span><i style={{ background: COLORS.good }} />掌握扎实</span>
        <span><i className="dashed" style={{ background: COLORS.thin }} />数据不足</span>
        <span className="legend-note">点圆点查看详情</span>
      </div>
    </div>
  );
}

function Detail({ r, fontScale = 1 }) {
  if (!r) {
    return (
      <div className="detail-empty">
        <Icon name="target" size={26} />
        <p>点击图上的知识点，查看它的掌握度、作答次数与预计遗忘时间。</p>
      </div>
    );
  }
  const thin = Number(r.confidence) < 0.3;
  const pct = Math.max(0, Math.min(100, Number(r.mastery)));
  const C = 2 * Math.PI * 46;
  return (
    <div className="kp-detail">
      <div className="kd-head">
        <div>
          <div className="kd-chapter">{r.chapter}</div>
          <h3>{r.kp_name}</h3>
        </div>
        <span className={`tag ${thin ? 'gray' : pct < 60 ? 'red' : pct < 85 ? 'gold' : 'green'}`}>
          {levelLabel(r)}
        </span>
      </div>
      <div className="kd-ring">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle cx="60" cy="60" r="46" fill="none" stroke="#e7dfcf" strokeWidth="9" />
          <circle cx="60" cy="60" r="46" fill="none" stroke={colorOf(r)} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 60 60)" />
          <text x="60" y="58" textAnchor="middle" fontSize={27 * fontScale} fontFamily="serif" fill="#1c2434">{Math.round(pct)}</text>
          <text x="60" y="76" textAnchor="middle" fontSize={10 * fontScale} fill="#8b8578">掌握度</text>
        </svg>
        <div className="kd-facts">
          <div><span>置信度</span><b>{Math.round(Number(r.confidence) * 100)}%</b></div>
          <div><span>作答次数</span><b>{r.attempt_cnt}</b></div>
          <div><span>答对 / 答错</span><b>{r.correct_cnt} / {r.error_cnt}</b></div>
          <div><span>连对</span><b>{r.streak} 次</b></div>
        </div>
      </div>
      {thin && <div className="kd-warn"><Icon name="warn" size={14} /> 作答次数太少，先不给结论 —— 这个分数只作参考。</div>}
      <div className="kd-grid">
        <div><span>主导错误</span><b>{r.err_type || '—'}</b></div>
        <div><span>上次练习</span><b>{String(r.last_practiced_at || '').slice(0, 10) || '—'}</b></div>
        <div><span>预计遗忘</span><b>{String(r.est_forget_at || '').slice(0, 10) || '—'}</b></div>
        <div><span>适配难度</span><b>{'●'.repeat(Math.max(1, Number(r.difficulty_level || 1)))}</b></div>
      </div>
      <div className="kd-note">预计遗忘时间只用于报告排序，<b>不会用来推送提醒</b>。</div>
    </div>
  );
}

export default function GraphView({ state, setView }) {
  const key = state.activeSubject;
  const fontScale = fontScaleOf(state.settings?.ui?.fontSize);
  const meta = getSubjectMeta(key);
  const ready = !!meta?.ready;
  const st = stats(state, key);
  const rows = state.kpMastery.filter((r) => rowSubjectKey(r) === key);
  const weak = weakKps(state, 12, key);
  const [selected, setSelected] = useState(() => weakKps(state, 1)[0] || rows[0] || null);
  const selectedRow = selected && rows.some((r) => Number(r.kp_id) === Number(selected.kp_id))
    ? selected
    : (weak[0] || rows[0] || null);
  const thin = rows.filter((r) => Number(r.confidence) < 0.3);

  const chapters = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const ch = r.chapter || '未分类';
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch).push(r);
    });
    return [...map.entries()].map(([name, items]) => {
      const reliable = items.filter((r) => Number(r.confidence) >= 0.3);
      return {
        name,
        items,
        avg: reliable.length ? reliable.reduce((s, r) => s + Number(r.mastery), 0) / reliable.length : 0,
        weak: reliable.filter((r) => Number(r.mastery) < 60).length,
        count: items.length
      };
    }).sort((a, b) => a.avg - b.avg);
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="page">
        <header className="view-head">
          <div><h1>知识图谱 <span className="subject-inline">· {subjectLabel(key)}</span></h1><p>掌握度是算出来的，不是感觉出来的。</p></div>
          <div className="head-actions"><SubjectSelect value={key} tone="light" compact /></div>
        </header>
        {!ready ? (
          <div className="empty-panel">
            <div className="empty-mark">接</div>
            <h2>{subjectLabel(key)} 的数据接口已预留</h2>
            <p>这个学科还没有导入知识点白名单。界面、存储和工作流已经按 <code>subject_key</code> 隔离，导入后图谱即可使用。</p>
            <div className="empty-actions">
              <button className="primary-btn" onClick={() => setActiveSubject('senior-math')}>切到高中数学 <Icon name="arrow" size={16} /></button>
              <button className="ghost-btn" onClick={() => setView('settings')}>查看学科接入表</button>
            </div>
          </div>
        ) : (
          <div className="empty-panel">
            <div className="empty-mark">图</div>
            <h2>{meta?.name}图谱还是空的</h2>
            <p>上传一份{meta?.name}试卷、核对完四问，这里就会长出第一个知识点。</p>
            <button className="primary-btn" onClick={() => setView('chat')}>去上传试卷 <Icon name="arrow" size={16} /></button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <header className="view-head">
        <div>
          <h1>知识图谱 <span className="subject-inline">· {subjectLabel(key)}</span></h1>
          <p>三档分类：需要加强 / 掌握良好 / 数据不足。置信度低于 30% 的不下结论。</p>
        </div>
        <div className="head-actions">
          <SubjectSelect value={key} tone="light" compact />
          <button className="ghost-btn" onClick={() => setView('reports')}><Icon name="report" size={16} /> 报告快照</button>
          <button className="primary-btn" onClick={() => setView('chat')}>继续上传 <Icon name="plus" size={16} /></button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="book" size={18} /></div>
          <div><b>{st.kpCount}<em> / {st.whitelist}</em></b><span>已覆盖知识点</span></div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon"><Icon name="warn" size={18} /></div>
          <div><b>{st.weakCount}</b><span>需要加强</span></div>
        </div>
        <div className="stat-card gold">
          <div className="stat-icon"><Icon name="target" size={18} /></div>
          <div><b>{st.avgMastery}</b><span>平均掌握度</span></div>
        </div>
        <div className="stat-card gray">
          <div className="stat-icon"><Icon name="clock" size={18} /></div>
          <div><b>{st.thinCount}</b><span>数据不足</span></div>
        </div>
      </div>

      <div className="graph-grid">
        <div className="panel graph-panel">
          <div className="panel-head">
            <div className="panel-title">掌握度星图</div>
            <div className="panel-sub">节点大小 = 作答次数 · 虚线 = 置信度不足</div>
          </div>
          <Constellation rows={rows} selected={selectedRow} onSelect={setSelected} fontScale={fontScale} />
        </div>
        <div className="panel detail-panel">
          <div className="panel-head"><div className="panel-title">知识点详情</div></div>
          <Detail r={selectedRow} fontScale={fontScale} />
        </div>
      </div>

      <div className="graph-lower" data-tour="graph-detail">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">按模块看</div>
            <div className="panel-sub">{chapters.length} 个模块有数据</div>
          </div>
          <div className="chapter-list">
            {chapters.map((ch) => (
              <div className="chapter-row" key={ch.name}>
                <div className="chapter-name">{ch.name}</div>
                <div className="chapter-bar"><i style={{ width: `${Math.max(2, ch.avg)}%` }} /></div>
                <div className="chapter-num">{ch.avg ? Math.round(ch.avg) : '—'}</div>
                <div className="chapter-meta">{ch.count} 个 · {ch.weak} 弱</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">优先补的漏洞</div>
            <div className="panel-sub">按掌握度升序</div>
          </div>
          {weak.length === 0 ? (
            <div className="panel-empty">还没有可靠数据。再做几道题，结论才站得住。</div>
          ) : (
            <div className="weak-list">
              {weak.map((r, i) => (
                <button className="weak-row" key={r.kp_id} onClick={() => setSelected(r)}>
                  <span className="weak-rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="weak-info">
                    <span className="weak-title">{r.kp_name}</span>
                    <span className="weak-chapter">{r.chapter} · 错 {r.error_cnt} 题</span>
                  </span>
                  <span className="weak-score">{Math.round(r.mastery)}</span>
                  <span className="weak-mark" style={{ background: colorOf(r) }} />
                </button>
              ))}
            </div>
          )}
          {thin.length > 0 && (
            <div className="thin-block">
              <div className="thin-title">数据不足（{thin.length}）</div>
              <div className="thin-chips">
                {thin.slice(0, 10).map((r) => <span key={r.kp_id}>{r.kp_name}</span>)}
                {thin.length > 10 && <span>…</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
