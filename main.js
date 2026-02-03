const { app, BrowserWindow, globalShortcut, ipcMain, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');

let mainWindow = null;
let isVisible = false;

const TEMP_DIR = path.join(os.tmpdir(), 'renderdragon-assets-temp');

function cleanTempDir() {
    try {
        if (fs.existsSync(TEMP_DIR)) {
            const files = fs.readdirSync(TEMP_DIR);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(TEMP_DIR, file));
                } catch (e) {
                    console.error(`Failed to delete temp file ${file}:`, e);
                }
            }
        } else {
            fs.mkdirSync(TEMP_DIR);
        }
    } catch (err) {
        console.error('Failed to clean/create temp dir:', err);
    }
}

function sanitizeFilename(filename) {
    const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(base);
    const name = path.basename(base, ext);
    return `${name}_${Date.now()}${ext}`;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Hide when loses focus
    mainWindow.on('blur', () => {
        hideWindow();
    });

    // Center window on screen
    mainWindow.center();
}

function showWindow() {
    if (mainWindow) {
        mainWindow.center();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('window-shown');
        isVisible = true;
    }
}

function hideWindow() {
    if (mainWindow) {
        mainWindow.hide();
        mainWindow.webContents.send('window-hidden');
        isVisible = false;
    }
}

function toggleWindow() {
    if (isVisible) {
        hideWindow();
    } else {
        showWindow();
    }
}

// Helper function to download file to path
function downloadToFile(url, filepath, options = {}) {
    const { timeout = 30000, maxSizeBytes = 500 * 1024 * 1024 } = options;

    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.get(url, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`HTTP status code ${response.statusCode}`));
            }

            const contentLength = parseInt(response.headers['content-length'], 10);
            if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
                return reject(new Error(`File size (${contentLength} bytes) exceeds limit of ${maxSizeBytes} bytes`));
            }

            const file = fs.createWriteStream(filepath);
            let receivedBytes = 0;

            let rejected = false;
            response.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (!rejected && receivedBytes > maxSizeBytes) {
                    rejected = true;
                    response.destroy();
                    file.close(() => {
                        fs.unlink(filepath, () => { });
                    });
                    reject(new Error(`File size exceeds limit of ${maxSizeBytes} bytes`));
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve({ success: true, path: filepath });
            });

            file.on('error', (err) => {
                fs.unlink(filepath, () => { });
                reject(err);
            });
        });

        request.on('timeout', () => {
            request.destroy();
            fs.unlink(filepath, () => { });
            reject(new Error('Request timed out'));
        });

        request.on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });

        if (timeout) {
            request.setTimeout(timeout);
        }
    });
}

// Helper function to copy file to clipboard
function copyFileToClipboard(filePath) {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            // Use PowerShell to set file drop list
            // Using single quotes for path in PowerShell requires escaping single quotes as ''
            const safePath = filePath.replace(/'/g, "''");
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms;
                [System.Collections.Specialized.StringCollection]$files = New-Object System.Collections.Specialized.StringCollection;
                $files.Add('${safePath}');
                [System.Windows.Forms.Clipboard]::SetFileDropList($files);
            `;
            // Encode command to avoid issues with special characters
            const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
            exec(`powershell -EncodedCommand ${encodedCommand}`, { timeout: 10000 }, (error) => {
                if (error) {
                    console.error('PowerShell error:', error);
                    resolve({ success: false, message: error.message });
                } else {
                    resolve({ success: true, type: 'file', path: filePath });
                }
            });
        } else if (process.platform === 'darwin') {
            const { exec } = require('child_process');
            // Use AppleScript to set clipboard to POSIX file
            // Properly escape the path for AppleScript by using \x22 for quotes
            const safePath = filePath.replace(/"/g, '\\x22');
            // Use printf-style escaping to avoid shell injection
            const script = `set the clipboard to POSIX file "${safePath}"`;
            exec(`osascript -e "${script}"`, { timeout: 10000 }, (error) => {
                if (error) {
                    resolve({ success: false, message: error.message });
                } else {
                    resolve({ success: true, type: 'file', path: filePath });
                }
            });
        } else {
            // Linux and others - Try to set text/uri-list
            try {
                // Write to clipboard as text/uri-list and plain text together
                const uriList = Buffer.from(`file://${filePath}\r\n`);
                clipboard.write({
                    'text/uri-list': uriList,
                    text: filePath
                });

                resolve({ success: true, type: 'file', path: filePath });
            } catch (err) {
                resolve({ success: false, message: err.message });
            }
        }
    });
}

app.whenReady().then(() => {
    cleanTempDir();
    createWindow();

    // Register global shortcut (Ctrl+Space)
    const registered = globalShortcut.register('CommandOrControl+Space', () => {
        toggleWindow();
    });

    if (!registered) {
        console.error('Failed to register global shortcut');
    }

    // IPC handlers
    ipcMain.handle('hide-window', () => {
        hideWindow();
    });

    ipcMain.handle('download-asset', async (event, url, filename) => {
        try {
            const result = await dialog.showSaveDialog(mainWindow, {
                defaultPath: filename,
                filters: [{ name: 'All Files', extensions: ['*'] }]
            });

            if (result.canceled || !result.filePath) {
                return { success: false, message: 'Download canceled' };
            }

            try {
                await downloadToFile(url, result.filePath);
                return { success: true, path: result.filePath };
            } catch (err) {
                return { success: false, message: err.message };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Copy to clipboard handler
    ipcMain.handle('copy-to-clipboard', async (event, url, filename, ext) => {
        try {
            const cleanFilename = sanitizeFilename(filename);
            const tempPath = path.join(TEMP_DIR, cleanFilename);

            // Download to file directly
            await downloadToFile(url, tempPath);

            // Copy file to clipboard (always as file drop for all types)
            return await copyFileToClipboard(tempPath);
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('will-quit', () => {
    cleanTempDir();
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
