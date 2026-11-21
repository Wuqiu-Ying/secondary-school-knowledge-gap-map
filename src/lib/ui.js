/* 字号设置：只影响排版，不改布局尺寸。
 * CSS 里所有 font-size 都写成 calc(Npx * var(--fs))，App 把 --fs 设为下面的 scale。
 */
export const APP_VERSION = '0.1.0';

// TODO: 正式发布前替换成真实仓库地址
export const GITHUB_URL = 'https://github.com/';

export const FONT_SIZES = [
  { key: 'small', label: '小', scale: 0.92, hint: '更紧凑' },
  { key: 'normal', label: '标准', scale: 1, hint: '默认' },
  { key: 'large', label: '大', scale: 1.16, hint: '更清楚' },
  { key: 'xlarge', label: '特大', scale: 1.32, hint: '最大' }
];

export const DEFAULT_FONT_SIZE = 'normal';

export function normalizeFontSize(value) {
  return FONT_SIZES.some((f) => f.key === value) ? value : DEFAULT_FONT_SIZE;
}

export function fontScaleOf(value) {
  return FONT_SIZES.find((f) => f.key === normalizeFontSize(value))?.scale || 1;
}

export function fontSizeLabel(value) {
  return FONT_SIZES.find((f) => f.key === normalizeFontSize(value))?.label || '标准';
}
