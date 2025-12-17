const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;
let serverExited = false;

const isDev = !app.isPackaged;
const SERVER_PORT = 5000;

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let timeoutId;
    
    const checkServer = () => {
      if (serverExited) {
        reject(new Error('Server process exited unexpectedly'));
        return;
      }
      
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          scheduleRetry();
        }
      });
      
      req.on('error', () => {
        scheduleRetry();
      });
      
      req.on('timeout', () => {
        req.destroy();
        scheduleRetry();
      });
      
      req.end();
    };
    
    const scheduleRetry = () => {
      if (Date.now() - startTime > timeout) {
        clearTimeout(timeoutId);
        reject(new Error('Server startup timeout'));
      } else {
        timeoutId = setTimeout(checkServer, 500);
      }
    };
    
    checkServer();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Film Studio Simulator',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false,
    backgroundColor: '#0a0a0a',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverExited = false;
    
    const rootDir = isDev 
      ? path.join(__dirname, '..')
      : path.dirname(app.getPath('exe'));
    
    let command, args, cwd;
    
    if (isDev) {
      command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      args = ['tsx', 'server/index.ts'];
      cwd = path.join(__dirname, '..');
    } else {
      command = process.execPath;
      const serverPath = path.join(app.getAppPath(), 'dist', 'index.cjs');
      args = [serverPath];
      cwd = app.getAppPath();
    }

    console.log(`Starting server in ${isDev ? 'development' : 'production'} mode`);
    console.log(`Command: ${command} ${args.join(' ')}`);
    console.log(`CWD: ${cwd}`);

    serverProcess = spawn(command, args, {
      cwd: cwd,
      env: { 
        ...process.env, 
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: SERVER_PORT.toString(),
        ELECTRON: 'true'
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server process:', error);
      serverExited = true;
      reject(error);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`Server process exited with code ${code}, signal ${signal}`);
      serverExited = true;
      serverProcess = null;
    });

    waitForServer(SERVER_PORT)
      .then(resolve)
      .catch(reject);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess || serverExited) {
      resolve();
      return;
    }
    
    console.log('Stopping server...');
    
    const forceKillTimeout = setTimeout(() => {
      console.log('Force killing server...');
      if (serverProcess && !serverExited) {
        serverProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);
    
    serverProcess.once('exit', () => {
      clearTimeout(forceKillTimeout);
      resolve();
    });
    
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t'], {
        windowsHide: true
      });
    } else {
      serverProcess.kill('SIGTERM');
    }
  });
}

app.whenReady().then(async () => {
  try {
    console.log('Starting Film Studio Simulator...');
    console.log(`App path: ${app.getAppPath()}`);
    console.log(`Is packaged: ${app.isPackaged}`);
    
    await startServer();
    console.log('Server started successfully');
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    await stopServer();
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !serverExited) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (serverProcess && !serverExited) {
    event.preventDefault();
    await stopServer();
    app.quit();
  }
});
