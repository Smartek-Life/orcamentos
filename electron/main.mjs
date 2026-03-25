import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
const projectSaveLocks = new Map();

function getCodexProjectsDir() {
  return path.join(app.getPath('desktop'), 'projetos codex');
}

function getProjectFilePath(projectKey) {
  const safeName = String(projectKey || 'projeto')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .trim();
  return path.join(getCodexProjectsDir(), `${safeName}.json`);
}

function getCorruptedProjectFilePath(projectKey) {
  return `${getProjectFilePath(projectKey)}.corrupted`;
}

function resolveClientIndexPath() {
  const candidates = [
    path.resolve(currentDir, '../dist/client/index.html'),
    path.resolve(process.cwd(), 'dist/client/index.html'),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Nao foi possivel localizar o build do cliente desktop.');
  }

  return found;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 780,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#F2F7FB',
    webPreferences: {
      preload: path.join(currentDir, 'preload.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  await mainWindow.loadURL(pathToFileURL(resolveClientIndexPath()).href);
}

ipcMain.handle('project:export-pdf', async (_event, payload) => {
  const fileName = typeof payload?.fileName === 'string' && payload.fileName.trim() ? payload.fileName.trim() : 'Relatorio do Projeto';
  const html = typeof payload?.html === 'string' ? payload.html : '';

  if (!html.trim()) {
    throw new Error('Nao foi possivel gerar o conteudo do relatorio.');
  }

  const reportsDir = path.join(app.getPath('desktop'), 'relatorios codex');
  await fsPromises.mkdir(reportsDir, { recursive: true });
  const timestamp = new Date()
    .toISOString()
    .replace(/[:]/g, '-')
    .replace(/\..+$/, '')
    .replace('T', ' ');
  const safeName = fileName.replace(/[<>:"/\\|?*]+/g, ' ').trim() || 'Relatorio do Projeto';
  const filePath = path.join(reportsDir, `${safeName} - ${timestamp}.pdf`);
  const exportHtmlPath = path.join(app.getPath('temp'), `codex-report-${Date.now()}.html`);

  const exportWindow = new BrowserWindow({
    show: false,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await fsPromises.writeFile(exportHtmlPath, html, 'utf-8');
    await exportWindow.loadURL(pathToFileURL(exportHtmlPath).href);
    const pdfBuffer = await exportWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });

    await fsPromises.writeFile(filePath, pdfBuffer);
    return { canceled: false, filePath };
  } finally {
    await fsPromises.unlink(exportHtmlPath).catch(() => undefined);
    if (!exportWindow.isDestroyed()) {
      exportWindow.close();
    }
  }
});

ipcMain.handle('project:load-state', async (_event, payload) => {
  const projectKey = typeof payload?.projectKey === 'string' ? payload.projectKey : '';
  if (!projectKey) {
    return null;
  }

  const filePath = getProjectFilePath(projectKey);

  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8');
    if (!raw.trim()) {
      await fsPromises.unlink(filePath).catch(() => undefined);
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'EBUSY')
    ) {
      return null;
    }
    if (error instanceof SyntaxError) {
      const corruptedPath = getCorruptedProjectFilePath(projectKey);
      await fsPromises.rename(filePath, corruptedPath).catch(() => undefined);
      return null;
    }
    throw error;
  }
});

ipcMain.handle('project:save-state', async (_event, payload) => {
  const state = payload?.state;
  const projectKey = typeof state?.projectKey === 'string' ? state.projectKey : '';
  if (!projectKey) {
    throw new Error('Projeto sem chave valida para persistencia.');
  }

  const previousSave = projectSaveLocks.get(projectKey) ?? Promise.resolve();
  const nextSave = previousSave
    .catch(() => undefined)
    .then(async () => {
      const projectsDir = getCodexProjectsDir();
      const filePath = getProjectFilePath(projectKey);
      const tempFilePath = `${filePath}.${Date.now()}.tmp`;
      const serializedState = JSON.stringify(state, null, 2);

      await fsPromises.mkdir(projectsDir, { recursive: true });
      await fsPromises.writeFile(tempFilePath, serializedState, 'utf-8');

      try {
        await fsPromises.unlink(filePath).catch((error) => {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return;
          }
          throw error;
        });
        await fsPromises.rename(tempFilePath, filePath);
      } catch {
        await fsPromises.writeFile(filePath, serializedState, 'utf-8');
        await fsPromises.unlink(tempFilePath).catch(() => undefined);
      }

      return { filePath };
    });

  projectSaveLocks.set(projectKey, nextSave);

  try {
    return await nextSave;
  } finally {
    if (projectSaveLocks.get(projectKey) === nextSave) {
      projectSaveLocks.delete(projectKey);
    }
  }
});

ipcMain.handle('project:clear-state', async (_event, payload) => {
  const projectKey = typeof payload?.projectKey === 'string' ? payload.projectKey : '';
  if (!projectKey) {
    return { cleared: false };
  }

  const filePath = getProjectFilePath(projectKey);

  try {
    await fsPromises.unlink(filePath);
    return { cleared: true };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { cleared: true };
    }
    throw error;
  }
});

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox('Falha ao iniciar o WiFi Planner', error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
