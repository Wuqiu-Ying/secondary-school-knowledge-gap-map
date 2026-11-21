import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { submitConfirmation, skipConfirmation } from '../lib/agent.js';

function fmtNo(no) {
  const p = String(no).split('-');
  return p.length === 2 ? `${p[0]}-${p[1]}` : String(no);
}

function Chip({ children, active, tone = 'warn', onClick, disabled }) {
  return (
    <button type="button" disabled={disabled} className={`qchip ${active ? 'active' : ''} tone-${tone}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function ConfirmCard({ payload, active }) {
  const [sel, setSel] = useState({
    missed: [], extra: [], calc: [], lucky: [], noIdea: [], noTime: []
  });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const questions = payload.questions || [];
  const wrong = useMemo(() => questions.filter((q) => !q.is_correct && String(q.user_answer || '').trim()), [questions]);
  const blank = useMemo(() => questions.filter((q) => !String(q.user_answer || '').trim()), [questions]);
  const all = questions;

  const toggle = (key, no) => {
    setSel((prev) => {
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(no) ? arr.filter((x) => x !== no) : [...arr, no] };
    });
  };
  const setOne = (key, no, otherKey) => {
    setSel((prev) => {
      const next = { ...prev, [key]: prev[key].includes(no) ? [] : [no] };
      if (otherKey) next[otherKey] = prev[otherKey].filter((x) => x !== no);
      return next;
    });
  };

  const count = Object.values(sel).reduce((s, a) => s + a.length, 0);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setDone(true);
    const params = {
      paper_id: payload.paperId,
      missed_wrong: sel.missed.join('、'),
      extra_wrong: sel.extra.join('、'),
      calc_error: sel.calc.join('、'),
      lucky_guess: sel.lucky.join('、'),
      blank_no_idea: sel.noIdea.join('、'),
      blank_no_time: sel.noTime.join('、')
    };
    const bits = [];
    if (sel.missed.length) bits.push(`漏判 ${sel.missed.join('、')}`);
    if (sel.extra.length) bits.push(`误判 ${sel.extra.join('、')}`);
    if (sel.calc.length) bits.push(`计算失误 ${sel.calc.join('、')}`);
    if (sel.lucky.length) bits.push(`蒙对 ${sel.lucky.join('、')}`);
    if (sel.noIdea.length) bits.push(`空题不会 ${sel.noIdea.join('、')}`);
    if (sel.noTime.length) bits.push(`空题没时间 ${sel.noTime.join('、')}`);
    const summary = bits.length ? `核对：${bits.join('；')}` : '这份卷子的识别结果我都确认，没有要补充的。';
    await submitConfirmation(params, summary);
    setBusy(false);
  };

  const disabled = !active || done || busy;

  return (
    <div className={`confirm-card ${active ? '' : 'inactive'}`}>
      <div className="cc-head">
        <div>
          <div className="cc-kicker">试卷核对 · 四问</div>
          <div className="cc-title">{payload.title}</div>
        </div>
        <div className="cc-badge">{payload.questionCount} 题</div>
      </div>

      {!active && <div className="cc-done-badge"><Icon name="check" size={14} /> 这份卷子已完成核对</div>}

      <div className="cc-meta">
        识别到 {payload.questionCount} 题 · 错题 {payload.wrongList ? payload.wrongList.split('、').length : 0} 道
        {payload.blankList ? ` · 空题 ${payload.blankList.split('、').length} 道` : ''}
        {payload.unmappedCount ? ` · 未归类 ${payload.unmappedCount} 道` : ''}
      </div>

      <section className="cc-sec">
        <div className="cc-sec-head"><span className="cc-num">①</span> 错题清单对不对？</div>
        <p className="cc-hint">有没有我漏判的（你错了、我判成对）？有没有我误判的（你做对了、我判成错）？</p>
        {wrong.length === 0 ? <div className="cc-empty">这次没有识别到非空错题。</div> : (
          <div className="cc-wrong-list">
            {wrong.map((q) => (
              <div className="cc-wrong-row" key={q.q_no}>
                <div className="cc-qno" title={q.stem}>{fmtNo(q.q_no)}</div>
                <div className="cc-qname">{q.kp_name || '未归类'}</div>
                <div className="cc-qactions">
                  <Chip tone="warn" disabled={disabled} active={sel.missed.includes(q.q_no)} onClick={() => setOne('missed', q.q_no, 'extra')}>漏判</Chip>
                  <Chip tone="ok" disabled={disabled} active={sel.extra.includes(q.q_no)} onClick={() => setOne('extra', q.q_no, 'missed')}>误判</Chip>
                </div>
              </div>
            ))}
          </div>
        )}
        {payload.uncertainList && (
          <div className="cc-warn"><Icon name="warn" size={14} /> 识别存疑：{payload.uncertainList}。这些题暂不计入掌握度。</div>
        )}
      </section>

      <section className="cc-sec">
        <div className="cc-sec-head"><span className="cc-num">②</span> 这些错题里，哪些是「会做但算错了」？</div>
        <p className="cc-hint">只影响归因，不计入掌握度 —— 会而失分不该被惩罚。</p>
        <div className="cc-chips">
          {wrong.length === 0 ? <span className="cc-empty">没有错题</span> : wrong.map((q) => (
            <Chip key={q.q_no} tone="calc" disabled={disabled} active={sel.calc.includes(q.q_no)} onClick={() => toggle('calc', q.q_no)}>{fmtNo(q.q_no)}</Chip>
          ))}
        </div>
      </section>

      <section className="cc-sec">
        <div className="cc-sec-head"><span className="cc-num">③</span> 有没有蒙对的题？</div>
        <p className="cc-hint">凭运气做对的题会被计为错 —— 这是隐形地雷，越早发现越好。</p>
        <div className="cc-chips scroll">
          {all.map((q) => (
            <Chip key={q.q_no} tone="lucky" disabled={disabled} active={sel.lucky.includes(q.q_no)} onClick={() => toggle('lucky', q.q_no)}>{fmtNo(q.q_no)}</Chip>
          ))}
        </div>
      </section>

      {blank.length > 0 && (
        <section className="cc-sec">
          <div className="cc-sec-head"><span className="cc-num">④</span> 关于空题</div>
          <p className="cc-hint">空题原因会改变结论：真的不会 → 记为需要加强；没时间 → 会而失分，不惩罚。</p>
          <div className="cc-blank-list">
            {blank.map((q) => (
              <div className="cc-blank-row" key={q.q_no}>
                <div className="cc-qno">{fmtNo(q.q_no)}</div>
                <div className="cc-qname">{q.kp_name || '未归类'}</div>
                <div className="cc-qactions">
                  <Chip tone="warn" disabled={disabled} active={sel.noIdea.includes(q.q_no)} onClick={() => setOne('noIdea', q.q_no, 'noTime')}>不会</Chip>
                  <Chip tone="ok" disabled={disabled} active={sel.noTime.includes(q.q_no)} onClick={() => setOne('noTime', q.q_no, 'noIdea')}>没时间</Chip>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="cc-ethics">
        <strong>请如实回答。</strong>把不会说成“算错”，系统以为你掌握了；把蒙对说成做出来，考场上这个漏洞会再爆一次；把没时间说成不会，你会被推一堆其实会的题。
      </div>

      <div className="cc-foot">
        <div className="cc-count">{count > 0 ? `已标记 ${count} 处` : '没有需要修改的，也可以直接提交'}</div>
        <div className="cc-btns">
          {active && !done && (
            <button className="text-btn" onClick={() => skipConfirmation()}>先不核对，直接看结果</button>
          )}
          <button className="primary-btn" onClick={submit} disabled={disabled}>
            {done ? '已提交' : busy ? '提交中…' : '提交核对'} <Icon name="check" size={16} />
          </button>
        </div>
      </div>
      <div className="cc-legal">先收数据，后给结论 —— 核对完成前不展示本卷速览。</div>
    </div>
  );
}
