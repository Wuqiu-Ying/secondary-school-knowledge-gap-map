const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');

const isDev = process.env.XQ_DEV === '1';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f4f0e6',
    title: '中学知识漏洞图谱',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.once('ready-to-show', () => win.show());
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://127.0.0.1:5178');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('ai:chat', async (_event, { url, apiKey, payload }) => {
  try {
    const resp = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      if (data?.error?.message) msg += `：${data.error.message}`;
      else if (data?.message) msg += `：${data.message}`;
      else msg += `：${text.slice(0, 300)}`;
      return { ok: false, error: msg, status: resp.status };
    }
    if (!data) return { ok: false, error: 'AI 返回的不是 JSON：' + text.slice(0, 200) };
    return { ok: true, data, status: resp.status };
  } catch (e) {
    return { ok: false, error: '网络请求失败：' + (e.message || String(e)) };
  }
});

app.whenReady().then(() => {
  app.setAppUserModelId('cn.aiedu.xueqing');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
