import React from 'react';

const paths = {
  chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4c-.6.5-1.3 0-1.3-.7V5.5Z',
  graph: 'M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6.7 6.7l8.6 8.6M8.4 15.8 15 6.6',
  paper: 'M6 3h9l4 4v14H6V3Zm8 1v4h4M9 12h6M9 16h6',
  report: 'M5 3h14v18H5V3Zm3 4h8M8 11h8M8 15h5',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8-3.2c0-.6-.1-1.1-.2-1.6l1.7-1.3-2-3.4-2 .8c-.8-.7-1.7-1.2-2.7-1.5L14.5 3h-5l-.3 2.1c-1 .3-1.9.8-2.7 1.5l-2-.8-2 3.4 1.7 1.3a8 8 0 0 0 0 3.2L2.5 15l2 3.4 2-.8c.8.7 1.7 1.2 2.7 1.5l.3 2.1h5l.3-2.1c1-.3 1.9-.8 2.7-1.5l2 .8 2-3.4-1.7-1.3c.1-.5.2-1 .2-1.6Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  send: 'm4 12 16-8-5.5 16-3-6.5L4 12Z',
  image: 'M4 5h16v14H4V5Zm3 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-1 10 5-5 3 3 2-2 3 3',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 20h14',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12 4 4L19 6',
  warn: 'M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5',
  close: 'M6 6l12 12M18 6 6 18',
  download: 'M12 4v12m0 0 4-4m-4 4-4-4M5 20h14',
  reset: 'M4 4v6h6M5.5 9A8 8 0 1 1 4 14',
  key: 'M14 7a4 4 0 1 1-3.2 6.4L4 20H2v-3l6.6-6.6A4 4 0 0 1 14 7Z',
  desktop: 'M3 5h18v11H3V5Zm6 15h6m-3-4v4',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm9 6 6 6-6 6',
  book: 'M4 4h7v16H4V4Zm9 0h7v16h-7V4Z',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14'
};

export default function Icon({ name, size = 20, stroke = 1.7, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
