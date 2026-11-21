import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initCatalog } from './lib/catalog.js';
import './styles.css';

const el = document.getElementById('root');
el.textContent = '正在加载知识点库…';
const root = createRoot(el);
initCatalog()
  .catch((e) => console.warn('知识点库初始化失败，使用内置版本', e))
  .finally(() => root.render(<App />));
