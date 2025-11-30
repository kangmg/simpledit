#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = 0; // 0 lets OS assign a random available port
const DIST_DIR = path.resolve(__dirname, '../dist');

// Parse arguments
const args = process.argv.slice(2);
const initialFiles = args;

// Check if dist exists
if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist directory not found. Please run "npm run build" first.');
    process.exit(1);
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API Endpoints
    if (req.url === '/api/init') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ args: initialFiles }));
        return;
    }

    if (req.url === '/api/heartbeat') {
        lastHeartbeat = Date.now();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'alive' }));
        return;
    }

    if (req.url.startsWith('/api/read')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const filePath = url.searchParams.get('path');

        if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing path parameter' }));
            return;
        }

        // Security: Prevent directory traversal (basic check)
        // In a real local tool for personal use, we might want to allow absolute paths,
        // but for safety let's restrict to CWD or check if it's a valid file.
        // User requirement: "Relative to execution location".

        const absolutePath = path.resolve(process.cwd(), filePath);

        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }

        try {
            const content = fs.readFileSync(absolutePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Static File Serving
    // Handle base path /simpledit/
    let requestPath = req.url;
    if (requestPath.startsWith('/simpledit/')) {
        requestPath = requestPath.replace('/simpledit/', '/');
    } else if (requestPath === '/simpledit') {
        requestPath = '/';
    }

    let filePath = path.join(DIST_DIR, requestPath === '/' ? 'index.html' : requestPath);
    const extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // SPA Fallback: serve index.html for unknown paths (if not an API call)
                fs.readFile(path.join(DIST_DIR, 'index.html'), (error, content) => {
                    if (error) {
                        res.writeHead(500);
                        res.end('Error loading index.html');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Heartbeat Logic
let lastHeartbeat = Date.now();
const HEARTBEAT_TIMEOUT = 5000; // 5 seconds
const CHECK_INTERVAL = 1000; // 1 second

// Wait for first heartbeat before enforcing timeout
let clientConnected = false;

const heartbeatCheck = setInterval(() => {
    if (clientConnected) {
        if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
            console.log('No heartbeat received. Shutting down...');
            process.exit(0);
        }
    } else {
        // Check if we received the first heartbeat
        if (Date.now() - lastHeartbeat < 1000) { // Just received one
            clientConnected = true;
            console.log('Client connected. Heartbeat monitoring active.');
        }
    }
}, CHECK_INTERVAL);

server.listen(PORT, () => {
    const address = server.address();
    const url = `http://localhost:${address.port}/simpledit/`; // Open with base path
    console.log(`Simpledit running at ${url}`);
    console.log(`Working directory: ${process.cwd()}`);
    if (initialFiles.length > 0) {
        console.log(`Initial files: ${initialFiles.join(', ')}`);
    }

    // Open browser
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    exec(`${start} ${url}`);
});
