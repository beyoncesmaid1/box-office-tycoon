const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

let mainWindow;
let serverProcess;
let serverExited = false;

const isDev = !app.isPackaged;
const DEVELOPMENT_SERVER_PORT = 5000;
let serverPort = DEVELOPMENT_SERVER_PORT;

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(error);
      }
    });
    probe.listen(startPort, '127.0.0.1', () => {
      const address = probe.address();
      const availablePort = typeof address === 'object' && address
        ? address.port
        : startPort;
      probe.close(() => resolve(availablePort));
    });
  });
}

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

  mainWindow.loadURL(`http://localhost:${serverPort}`);

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
      // app.getAppPath() points inside app.asar in packaged builds, which is
      // not a real directory that Windows can use as a child-process cwd.
      cwd = process.resourcesPath;
    }

    console.log(`Starting server in ${isDev ? 'development' : 'production'} mode`);
    console.log(`Command: ${command} ${args.join(' ')}`);
    console.log(`CWD: ${cwd}`);

    serverProcess = spawn(command, args, {
      cwd: cwd,
      env: { 
        ...process.env, 
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: serverPort.toString(),
        ELECTRON: 'true',
        // Reuse Electron's bundled Node runtime for the packaged server.
        ...(isDev ? {} : { ELECTRON_RUN_AS_NODE: '1' })
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

    waitForServer(serverPort)
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

    // Let Windows assign an ephemeral port in packaged builds so the desktop
    // app cannot collide with a development server or another local service.
    serverPort = isDev
      ? DEVELOPMENT_SERVER_PORT
      : await findAvailablePort(0);
    console.log(`Selected server port: ${serverPort}`);

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
