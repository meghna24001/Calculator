const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain',
    '.map': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
        return;
    }

    let filePath = path.normalize(path.join(ROOT_DIR, decodedUrl));
    if (filePath === ROOT_DIR || filePath === path.join(ROOT_DIR, path.sep)) {
        filePath = path.join(ROOT_DIR, 'index.html');
    }

    // Verify resolved path stays inside ROOT_DIR
    const rel = path.relative(ROOT_DIR, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
            'Service-Worker-Allowed': '/'
        });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
