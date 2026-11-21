import React, { useState } from 'react';

/** 圈起来的问号：悬停/聚焦/点击展示说明，手机端点一下也能看。 */
export default function HelpTip({ text, label = '查看说明' }) {
  const [open, setOpen] = useState(false);
  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  return (
    <span
      className={`help-wrap ${open ? 'open' : ''}`}
      onMouseEnter={() => { if (canHover()) setOpen(true); }}
      onMouseLeave={() => { if (canHover()) setOpen(false); }}
    >
      <button
        type="button"
        className="help-dot"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); setOpen((v) => (canHover() ? true : !v)); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && <span className="help-pop" role="tooltip">{text}</span>}
    </span>
  );
}
