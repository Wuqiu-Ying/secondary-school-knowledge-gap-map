import React from 'react';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 轻量 Markdown：只支持标题、粗体、行内代码、列表、分隔线。所有内容先转义。 */
export default function Markdown({ text, className = '' }) {
  const lines = String(text || '').split('\n');
  const html = [];
  let inList = false;

  const inline = (s) => escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, '');
    if (/^#{1,3}\s+/.test(line)) {
      if (inList) { html.push('</ul>'); inList = false; }
      const level = line.match(/^#+/)[0].length;
      html.push(`<h${level + 2}>${inline(line.replace(/^#{1,3}\s+/, ''))}</h${level + 2}>`);
      return;
    }
    if (/^[-·]\s+/.test(line) || /^-\s+/.test(line)) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(line.replace(/^[-·]\s+/, ''))}</li>`);
      return;
    }
    if (inList) { html.push('</ul>'); inList = false; }
    if (/^━+/.test(line)) {
      html.push(`<div class="md-divider">${escapeHtml(line)}</div>`);
      return;
    }
    if (/^【.+】$/.test(line.trim())) {
      html.push(`<div class="md-section">${inline(line)}</div>`);
      return;
    }
    if (!line.trim()) {
      html.push('<div class="md-gap"></div>');
      return;
    }
    html.push(`<p>${inline(line)}</p>`);
  });
  if (inList) html.push('</ul>');

  return <div className={`markdown ${className}`} dangerouslySetInnerHTML={{ __html: html.join('') }} />;
}
