import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as PELibrary from 'pe-library';
import * as ResEdit from 'resedit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(root, 'build', 'icon.ico');
const targets = process.argv.slice(2);

if (!targets.length) {
  console.error('用法: node scripts/apply-icon.mjs <exe> [exe...]');
  process.exit(1);
}

const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const [vmaj = 0, vmin = 0, vpatch = 0] = String(pkg.version || '0.0.0').split('.').map((n) => Number(n) || 0);

for (const target of targets) {
  const exePath = path.resolve(target);
  if (!fs.existsSync(exePath)) {
    console.warn('跳过（不存在）:', exePath);
    continue;
  }
  const data = fs.readFileSync(exePath);
  // Electron 的 exe 带签名，必须忽略证书解析；生成的新文件会去掉签名
  const exe = PELibrary.NtExecutable.from(data, { ignoreCert: true });
  const res = PELibrary.NtExecutableResource.from(exe);

  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (!groups.length) throw new Error('exe 里没有图标资源: ' + exePath);
  for (const group of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      group.id,
      group.lang,
      iconFile.icons.map((item) => item.data)
    );
  }

  const versionInfos = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (versionInfos.length) {
    const vi = versionInfos[0];
    vi.setFileVersion(vmaj, vmin, vpatch, 0, 1033);
    vi.setProductVersion(vmaj, vmin, vpatch, 0, 1033);
    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        ProductName: '中学知识漏洞图谱',
        FileDescription: '中学知识漏洞图谱 · Secondary School Knowledge Gap Map',
        CompanyName: 'Wuqiu-Ying',
        LegalCopyright: 'Copyright © 2026'
      }
    );
    vi.outputToResourceEntries(res.entries);
  }

  res.outputResource(exe);
  const out = Buffer.from(exe.generate());
  const tmp = exePath + '.icon-tmp';
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, exePath);
  console.log('图标已写入:', exePath, `(${out.length} bytes)`);
}
