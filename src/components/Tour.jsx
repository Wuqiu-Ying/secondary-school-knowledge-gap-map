import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export const TOUR_VERSION = 4;

const STEPS = [
  {
    view: 'chat',
    target: '[data-tour="chat-image"]',
    placement: 'top',
    title: '从这里上传试卷',
    body: '点这个图片按钮，拍照或选一张试卷照片。识别后我会先把题干、学生答案和知识点整理成错题清单。'
  },
  {
    view: 'chat',
    target: '[data-tour="chat-quick"]',
    placement: 'top',
    title: '不知道说什么，就点这些',
    body: '快捷按钮可以带你看图谱、回顾流程、打开上次报告。你也可以直接在输入框里说「看我的图谱」。'
  },
  {
    view: 'chat',
    target: '[data-tour="chat-rail"]',
    placement: 'left',
    title: '右侧是当前数据',
    body: '这里汇总了掌握度、白名单覆盖率、最薄弱的几个知识点。数据会随着每次核对变化。'
  },
  {
    view: 'graph',
    target: '[data-tour="graph-canvas"]',
    placement: 'bottom',
    title: '星图就是你的漏洞地图',
    body: '每个圆点是一个知识点：颜色表示掌握档位，大小表示权重或作答量。先看红色和灰色的区域。'
  },
  {
    view: 'graph',
    target: '[data-tour="graph-detail"]',
    placement: 'top',
    title: '点开一个知识点',
    body: '下方会显示掌握度、作答次数、置信度和预计遗忘时间。置信度低于 30% 时只标「数据不足」，不下结论。'
  },
  {
    view: 'papers',
    target: '[data-tour="papers-list"]',
    placement: 'right',
    title: '所有试卷都在档案里',
    body: '左边选试卷，右边看每道题的识别结果和核对状态。长表按题聚合，一题多个知识点也只算一道题。'
  },
  {
    view: 'reports',
    target: '[data-tour="reports-trend"]',
    placement: 'top',
    title: '报告记录每次变化',
    body: '每次核对后都会保存快照：平均掌握度、三档人数、最薄弱知识点。趋势图能看出是进步还是波动。'
  },
  {
    view: 'me',
    target: '[data-tour="me-font"]',
    placement: 'right',
    title: '看不清就把字号调大',
    body: '这里是阅读字号：小 / 标准 / 大 / 特大。选完整个界面的文字都会变，手机上看小字很有用。'
  },
  {
    view: 'me',
    target: '[data-tour="me-gear"]',
    placement: 'bottom',
    title: '右上角齿轮进入设置',
    body: '档案、AI 接口、知识点库版本、数据备份都在设置里。以后换教材、配模型、清数据都从这里进。'
  },
  {
    view: 'settings',
    target: '[data-tour="settings-ai"]',
    placement: 'left',
    title: '配置 API Key 和模型',
    body: '先打开启用开关，选一个服务预设，再填 Base URL、API Key、文本模型和视觉模型。文本模型负责对话和报告；视觉模型负责试卷 OCR——本应用没有本地 OCR，图片会发到视觉模型。DeepSeek Flash 这类多模态模型可以打开「同步文本模型」，让视觉模型自动跟随文本模型；点「测试连接」成功后再保存。'
  },
  {
    view: 'settings',
    target: '[data-tour="settings-catalog"]',
    placement: 'left',
    title: '知识点库可以更新',
    body: '这里显示当前 Pack 的版本、知识点数量和来源，也可以导入更新包或回到内置版本。'
  }
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export default function Tour({ view, setView, onDone }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const bubbleRef = useRef(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  }, []);

  const goNext = useCallback(() => {
    setIndex((n) => {
      if (n >= STEPS.length - 1) { finish(); return n; }
      return n + 1;
    });
  }, [finish]);

  const goPrev = useCallback(() => setIndex((n) => Math.max(0, n - 1)), []);

  // 切换页面，等目标出现，滚到可视区，记录位置
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let tries = 0;
    setRect(null);
    setPos(null);
    if (view !== step.view) {
      setView(step.view);
      return undefined;
    }

    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target);
      if (!el) {
        if (tries++ < 20) { timer = setTimeout(locate, 70); return; }
        if (index < STEPS.length - 1) setIndex(index + 1);
        else finish();
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) {
        if (index < STEPS.length - 1) setIndex(index + 1);
        else finish();
        return;
      }
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      timer = setTimeout(() => {
        if (cancelled) return;
        setRect(el.getBoundingClientRect());
      }, 90);
    };

    timer = setTimeout(locate, 140);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [index, step.view, step.target, view, setView, finish]);

  // 目标滚动/窗口变化时重新测量
  useEffect(() => {
    const remeasure = () => {
      const el = document.querySelector(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 8) setRect(r);
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [step.target]);

  // 根据目标位置和气泡尺寸算气泡位置
  useLayoutEffect(() => {
    if (!rect || !bubbleRef.current) return;
    const bubble = bubbleRef.current;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 12;
    const G = 14;
    const space = {
      top: rect.top - M,
      bottom: vh - rect.bottom - M,
      left: rect.left - M,
      right: vw - rect.right - M
    };
    let placement = step.placement;
    if (!placement || placement === 'auto') {
      if (space.bottom >= bh + G) placement = 'bottom';
      else if (space.top >= bh + G) placement = 'top';
      else if (space.right >= bw + G) placement = 'right';
      else if (space.left >= bw + G) placement = 'left';
      else placement = 'bottom';
    }
    // 指定方向空间不够时换方向
    if (placement === 'bottom' && space.bottom < bh + G && space.top >= bh + G) placement = 'top';
    if (placement === 'top' && space.top < bh + G && space.bottom >= bh + G) placement = 'bottom';
    if (placement === 'left' && space.left < bw + G && space.right >= bw + G) placement = 'right';
    if (placement === 'right' && space.right < bw + G && space.left >= bw + G) placement = 'left';
    // 左右都放不下（手机上的全宽卡片）时改到上下
    if ((placement === 'left' || placement === 'right')
      && space.left < bw + G && space.right < bw + G) {
      placement = space.bottom >= bh + G ? 'bottom' : (space.top >= bh + G ? 'top' : 'bottom');
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let left = 0;
    let top = 0;
    let arrowX = 0;
    let arrowY = 0;

    if (placement === 'bottom') {
      top = rect.bottom + G;
      left = clamp(cx - bw / 2, M, vw - bw - M);
      arrowX = clamp(cx - left, 20, bw - 20);
    } else if (placement === 'top') {
      top = rect.top - G - bh;
      left = clamp(cx - bw / 2, M, vw - bw - M);
      arrowX = clamp(cx - left, 20, bw - 20);
    } else if (placement === 'right') {
      left = rect.right + G;
      top = clamp(cy - bh / 2, M, vh - bh - M);
      arrowY = clamp(cy - top, 20, bh - 20);
    } else {
      left = rect.left - G - bw;
      top = clamp(cy - bh / 2, M, vh - bh - M);
      arrowY = clamp(cy - top, 20, bh - 20);
    }
    left = clamp(left, M, vw - bw - M);
    top = clamp(top, M, vh - bh - M);
    const next = { left, top, placement, arrowX, arrowY };
    setPos((prev) => (prev
      && prev.left === next.left && prev.top === next.top
      && prev.placement === next.placement
      && prev.arrowX === next.arrowX && prev.arrowY === next.arrowY
      ? prev : next));
  }, [rect, step.placement]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, goNext, goPrev]);

  const highlight = rect ? {
    left: rect.left - 6,
    top: rect.top - 6,
    width: rect.width + 12,
    height: rect.height + 12
  } : null;

  return (
    <div className="tour-layer" aria-live="polite">
      <div className="tour-catch" />
      {highlight && <div className="tour-highlight" style={highlight} />}
      <div
        ref={bubbleRef}
        className={`tour-bubble ${pos ? 'visible' : ''}`}
        style={pos ? { left: pos.left, top: pos.top } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        {pos && (
          <span
            className={`tour-arrow ${pos.placement}`}
            style={pos.placement === 'top' || pos.placement === 'bottom'
              ? { left: pos.arrowX }
              : { top: pos.arrowY }}
          />
        )}
        <div className="tour-top">
          <span className="tour-kicker">新手引导 · {index + 1} / {STEPS.length}</span>
          <button className="icon-btn tour-close" onClick={finish} aria-label="关闭新手引导">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="tour-progress"><i style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} /></div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="ghost-btn" onClick={finish}>跳过</button>
          <div className="tour-next">
            {index > 0 && <button className="ghost-btn" onClick={goPrev}>上一步</button>}
            <button className="primary-btn" onClick={goNext}>
              {last ? '完成' : '下一步'} <Icon name="arrow" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
