import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const outRoot = path.join(root, 'release', '中学知识漏洞图谱-win32-x64');
const appDir = path.join(outRoot, 'resources', 'app');

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('缺少 dist/index.html，请先运行 npm run build');
  process.exit(1);
}
if (!fs.existsSync(path.join(electronDist, 'electron.exe'))) {
  console.error('缺少 Electron 运行时，请先安装并解压 electron');
  process.exit(1);
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });

// 1) Electron 运行时
fs.cpSync(electronDist, outRoot, { recursive: true });
fs.renameSync(path.join(outRoot, 'electron.exe'), path.join(outRoot, '中学知识漏洞图谱.exe'));

// 2) 应用代码
fs.cpSync(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true });
fs.cpSync(path.join(root, 'electron'), path.join(appDir, 'electron'), { recursive: true });
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
  name: 'secondary-school-knowledge-gap-map',
  productName: '中学知识漏洞图谱',
  version: '0.1.0',
  description: 'Local-first AI knowledge-gap map for secondary-school students.',
  main: 'electron/main.cjs'
}, null, 2), 'utf8');

// 3) 说明文件
fs.writeFileSync(path.join(outRoot, '使用说明.txt'), [
  '中学知识漏洞图谱 · 单机版 0.1.0',
  '',
  '双击「中学知识漏洞图谱.exe」启动。',
  '数据保存在本机用户目录（Electron userData），卸载或换机前请在“设置 → 数据 → 导出备份”。',
  '',
  'AI 接口：设置 → AI 接口，可挂载任意 OpenAI Chat Completions 兼容服务。',
  '不配置 AI 也能离线使用全部工作流（演示试卷 / 手工核对 / 图谱）。',
  '',
  '开发模式：npm run dev',
  '安装包构建：npm run dist:win（需要网络下载 NSIS；离线可用本便携版）'
].join('\r\n'), 'utf8');

const size = (dir) => {
  let s = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    s += e.isDirectory() ? size(p) : fs.statSync(p).size;
  }
  return s;
};
console.log('portable built:', outRoot);
console.log('size:', (size(outRoot) / 1024 / 1024).toFixed(1), 'MB');
