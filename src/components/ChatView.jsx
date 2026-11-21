import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Markdown from './Markdown.jsx';
import ConfirmCard from './ConfirmCard.jsx';
import SubjectSelect from './SubjectSelect.jsx';
import { handleUserMessage, showReport } from '../lib/agent.js';
import { stats, weakKps, nowStr } from '../lib/core.js';
import { loadDemo, setActiveSubject } from '../lib/store.js';
import { getSubjectMeta, subjectLabel } from '../data/subjects.js';
import { APP_VERSION } from '../lib/ui.js';

async function fileToDataUrl(file) {
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = raw;
    });
    const max = 1800;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch (e) {
    return raw;
  }
}

function SettlementCard({ payload, setView }) {
  const c = payload.confirm || {};
  return (
    <div className="settle-card">
      <div className="settle-head">
        <div className="settle-icon"><Icon name="check" size={20} /></div>
        <div>
          <div className="settle-title">核对完成 · 掌握度已更新</div>
          <div className="settle-sub">{payload.title}</div>
        </div>
        <div className="settle-stats">
          <div><b>{payload.kpCount}</b><span>知识点</span></div>
          <div><b>{payload.weakCount}</b><span>需加强</span></div>
          <div><b>{payload.avgMastery}</b><span>平均掌握</span></div>
        </div>
      </div>

      {c.updateCount > 0 ? (
        <div className="settle-line"><Icon name="check" size={14} /> 已应用 {c.updateCount} 处修正，其余识别结果一并确认。</div>
      ) : (
        <div className="settle-line"><Icon name="check" size={14} /> 没有修改，识别结果已确认。</div>
      )}
      {c.rejectedCount > 0 && (
        <div className="settle-line warn"><Icon name="warn" size={14} /> {c.rejectedCount} 个题号没找到：{c.rejected.map((r) => r.q_no).join('、')}</div>
      )}
      {c.truncated && <div className="settle-line warn"><Icon name="warn" size={14} /> 题量较大，本次核对可能未覆盖全部题目。</div>}

      {payload.paperMap && (
        <div className="settle-map">
          <div className="settle-label">本卷速览</div>
          <pre>{payload.paperMap}</pre>
        </div>
      )}

      <div className="settle-actions">
        <button className="primary-btn" onClick={() => setView('graph')}>看知识图谱 <Icon name="arrow" size={16} /></button>
        <button className="ghost-btn" onClick={() => setView('reports')}>查看报告</button>
      </div>
    </div>
  );
}

function ReportMessage({ payload, text, setView }) {
  return (
    <div className="report-msg">
      <div className="report-msg-head">
        <div>
          <div className="rp-kicker">知识漏洞图谱</div>
          <div className="rp-stats">
            <span>{payload.kpCount} 个知识点</span>
            <span>{payload.weakCount} 个需加强</span>
            <span>平均 {payload.avgMastery}</span>
          </div>
        </div>
        <button className="text-btn" onClick={() => setView('graph')}>打开图谱 <Icon name="arrow" size={14} /></button>
      </div>
      <Markdown text={text} />
    </div>
  );
}

function Bubble({ m, setView, state }) {
  if (m.role === 'user') {
    return (
      <div className="msg-row user">
        <div className="bubble user-bubble">
          {m.imageCount ? <div className="img-count"><Icon name="image" size={14} /> {m.imageCount} 张试卷照片</div> : null}
          <div className="bubble-text">{m.text}</div>
          <div className="msg-time">{m.time?.slice(11, 16)}</div>
        </div>
      </div>
    );
  }

  if (m.kind === 'confirm') {
    const active = state.pendingPaperId === m.payload.paperId;
    return (
      <div className="msg-row assistant wide">
        <div className="assistant-avatar">析</div>
        <ConfirmCard payload={m.payload} active={active} />
      </div>
    );
  }

  if (m.kind === 'settlement') {
    return (
      <div className="msg-row assistant wide">
        <div className="assistant-avatar">析</div>
        <SettlementCard payload={m.payload} setView={setView} />
      </div>
    );
  }

  return (
    <div className={`msg-row assistant ${m.kind === 'error' ? 'is-error' : ''}`}>
      <div className="assistant-avatar">析</div>
      <div className={`bubble assistant-bubble kind-${m.kind || 'text'}`}>
        {m.kind === 'report' ? <ReportMessage payload={m.payload} text={m.text} setView={setView} /> : (
          <>
            {m.text && <Markdown text={m.text} />}
            {m.kind === 'needVision' && (
              <div className="inline-actions">
                <button className="inline-btn" onClick={() => setView('settings')}>去配置 AI 接口 <Icon name="arrow" size={14} /></button>
                <button className="inline-btn" onClick={() => { loadDemo(); }}>载入演示试卷</button>
              </div>
            )}
            {m.kind === 'progress' && <div className="typing"><span /><span /><span /></div>}
          </>
        )}
        <div className="msg-time">{m.time?.slice(11, 16)}</div>
      </div>
    </div>
  );
}

export default function ChatView({ state, setView, notify }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const st = stats(state);
  const weak = weakKps(state, 5);
  const meta = getSubjectMeta(state.activeSubject);
  const ready = !!meta?.ready;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = state.chat[state.chat.length - 1];
    if (last?.kind === 'confirm' || last?.kind === 'settlement' || last?.kind === 'report') {
      const sel = last.kind === 'confirm' ? '.confirm-card' : last.kind === 'settlement' ? '.settle-card' : '.report-msg';
      const cards = el.querySelectorAll(sel);
      const card = cards[cards.length - 1];
      if (card) {
        const top = card.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 14;
        el.scrollTo({ top, behavior: 'smooth' });
        return;
      }
    }
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [state.chat.length, sending]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  }, [text]);

  const send = async () => {
    if (sending) return;
    const t = text.trim();
    const imgs = images;
    if (!t && imgs.length === 0) return;
    setText('');
    setImages([]);
    setSending(true);
    try {
      await handleUserMessage(t, imgs.map((x) => x.url));
    } catch (e) {
      notify?.(`出错了：${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const fire = async (t) => {
    if (sending || !t.trim()) return;
    setText('');
    setSending(true);
    try {
      await handleUserMessage(t, []);
    } catch (e) {
      notify?.(`出错了：${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    e.target.value = '';
    if (!files.length) return;
    const next = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      next.push({ name: f.name, url: await fileToDataUrl(f) });
    }
    setImages((prev) => [...prev, ...next].slice(0, 6));
  };

  const quick = [
    { label: `看我的${meta?.name || ''}图谱`, icon: 'graph' },
    { label: '怎么用', icon: 'book' },
    { label: '上次的报告', icon: 'report' }
  ];

  const reservedPanel = (
    <div className="subject-reserved">
      <div className="empty-mark">接</div>
      <div className="reserved-kicker">学科数据接口 · 已预留</div>
      <h2>{subjectLabel(state.activeSubject)} 还没有接入数据</h2>
      <p>
        界面、存储结构和工作流都已经按 <code>subject_key</code> 隔离。
        这个学科还缺一份知识点白名单（<code>src/data/kp/&lt;key&gt;.js</code>）和对应的章节 / Tag 表。
      </p>
      <div className="reserved-actions">
        <button className="primary-btn" onClick={() => setActiveSubject('senior-math')}>
          切到高中数学 <Icon name="arrow" size={16} />
        </button>
        <button className="ghost-btn" onClick={() => setView('settings')}>查看学科接入表</button>
      </div>
      <div className="reserved-note">
        接入方法：<code>docs/SUBJECTS.md</code> · kp_id 段码 <b>{meta?.kpPrefix}</b>
      </div>
    </div>
  );

  return (
    <div className="chat-layout">
      <div className="chat-main">
        <header className="view-head">
          <div>
            <h1>对话 <span className="subject-inline">· {subjectLabel(state.activeSubject)}</span></h1>
            <p>识别试卷 · 四问核对 · 更新掌握度。当前学科：{subjectLabel(state.activeSubject)}。</p>
          </div>
          <div className="head-status">
            <SubjectSelect value={state.activeSubject} tone="light" compact />
            <span className={`status-pill ${state.settings.ai.enabled ? 'on' : ''}`}>
              <span className="dot" />{state.settings.ai.enabled ? 'AI 增强已开启' : '本地模式'}
            </span>
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {!ready ? reservedPanel : (
            <>
              {state.chat.length === 0 && (
                <div className="chat-empty">
                  <div className="empty-mark">析</div>
                  <h2>把{meta?.name || ''}试卷放进来，我们从错题开始。</h2>
                  <p>我会先识别、再给你四问核对卡。核对完成之前，不会给你看结论。</p>
                  <div className="empty-actions">
                    <button className="primary-btn" onClick={() => fileRef.current?.click()}><Icon name="image" size={17} /> 上传试卷照片</button>
                    <button className="ghost-btn" onClick={() => showReport()}><Icon name="graph" size={17} /> 直接看图谱</button>
                  </div>
                </div>
              )}
              {state.chat.map((m) => <Bubble key={m.id} m={m} setView={setView} state={state} />)}
              {sending && (
                <div className="msg-row assistant">
                  <div className="assistant-avatar">析</div>
                  <div className="bubble assistant-bubble"><div className="typing"><span /><span /><span /></div></div>
                </div>
              )}
            </>
          )}
        </div>

        {ready ? (
          <div className="composer-wrap">
            {state.chat.length > 0 && (
              <div className="quick-row" data-tour="chat-quick">
                {quick.map((q) => (
                  <button key={q.label} className="quick-chip" disabled={sending} onClick={() => fire(q.label)}>
                    <Icon name={q.icon} size={13} /> {q.label}
                  </button>
                ))}
              </div>
            )}
            {images.length > 0 && (
              <div className="composer-images">
                {images.map((im, i) => (
                  <div className="composer-img" key={i}>
                    <img src={im.url} alt={im.name} />
                    <button onClick={() => setImages(images.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="composer" data-tour="chat-composer">
              <button className="icon-btn" data-tour="chat-image" title="上传试卷照片" onClick={() => fileRef.current?.click()} disabled={sending}>
                <Icon name="image" size={20} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
              <textarea
                ref={taRef}
                rows={1}
                value={text}
                placeholder={`发${meta?.name || ''}试卷照片，或说「看我的图谱」…`}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                disabled={sending}
              />
              <button className="send-btn" onClick={send} disabled={sending || (!text.trim() && !images.length)} title="发送">
                <Icon name="send" size={18} />
              </button>
            </div>
            <div className="composer-note">Enter 发送 · Shift + Enter 换行 · 数据只保存在本机</div>
          </div>
        ) : (
          <div className="composer-wrap">
            <div className="reserved-composer">该学科尚未接入知识点白名单，暂不能上传试卷。</div>
          </div>
        )}
      </div>

      <aside className="chat-rail" data-tour="chat-rail">
        <div className="rail-card profile-rail">
          <div className="avatar lg">{(state.profile.nickname || '同学').slice(0, 1)}</div>
          <div>
            <div className="rail-name">{state.profile.nickname || '未命名同学'}</div>
            <div className="rail-sub">{state.profile.profile_summary}</div>
            <div className="rail-subject">{subjectLabel(state.activeSubject)}</div>
          </div>
        </div>

        <div className="rail-card">
          <div className="rail-title">{subjectLabel(state.activeSubject)} · 当前状态</div>
          <div className="mini-stats">
            <div><b>{st.kpCount}</b><span>已覆盖</span></div>
            <div><b>{st.weakCount}</b><span>需加强</span></div>
            <div><b>{st.avgMastery}</b><span>平均掌握</span></div>
          </div>
          <div className="coverage">
            <div className="coverage-bar"><i style={{ width: `${Math.max(2, st.coverage)}%` }} /></div>
            <div className="coverage-text">白名单覆盖 {st.coverage}% · 共 {st.whitelist} 个知识点</div>
          </div>
        </div>

        <div className="rail-card">
          <div className="rail-title">最薄弱的几个</div>
          {!ready ? (
            <div className="rail-empty">该学科数据接口已预留，尚未导入知识点白名单。</div>
          ) : weak.length === 0 ? (
            <div className="rail-empty">还没有可靠数据。上传一份卷子，核对完再看。</div>
          ) : (
            <div className="weak-mini">
              {weak.map((r) => (
                <div className="weak-mini-row" key={r.kp_id}>
                  <span className="weak-name">{r.kp_name}</span>
                  <span className="weak-bar"><i style={{ width: `${r.mastery}%` }} /></span>
                  <span className="weak-val">{Math.round(r.mastery)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="rail-demo" onClick={() => { loadDemo(); notify?.('演示档案已重新载入（高中数学）'); }}>
          <Icon name="spark" size={16} />
          <span>载入演示档案 · 高中数学</span>
        </button>

        <div className="rail-foot">v{APP_VERSION} · 单机版<br />数据仅存于本机存储</div>
      </aside>
    </div>
  );
}
