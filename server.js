const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();

let files = [];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILE_EXPIRY_MINUTES = 10;

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE }
});

app.use(express.static('public'));
app.use(express.json());

const deleteExpiredFiles = () => {
    const now = Date.now();
    const expiryMs = FILE_EXPIRY_MINUTES * 60 * 1000;
    const initialLength = files.length;
    files = files.filter(file => (now - file.uploadTime) <= expiryMs);
    if (files.length !== initialLength) {
        console.log('Deleted ' + (initialLength - files.length) + ' expired files');
    }
};
setInterval(deleteExpiredFiles, 60 * 1000);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.post('/api/v1/upload', upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const randomCode = crypto.randomBytes(5).toString('hex');
        const extension = path.extname(req.file.originalname);
        const filename = randomCode + extension;

        const fileData = {
            id: Date.now(),
            originalName: req.file.originalname,
            generatedName: filename,
            size: req.file.size,
            sizeText: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
            uploadTime: Date.now(),
            expiresIn: FILE_EXPIRY_MINUTES + ' menit',
            url: req.protocol + '://' + req.get('host') + '/' + filename,
            data: req.file.buffer.toString('base64')
        };

        files.push(fileData);

        res.json({
            success: true,
            message: 'File berhasil diupload!',
            data: {
                id: fileData.id,
                originalName: fileData.originalName,
                generatedName: fileData.generatedName,
                size: fileData.sizeText,
                expiresIn: fileData.expiresIn,
                url: fileData.url
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/list', (req, res) => {
    try {
        const now = Date.now();
        const expiryMs = FILE_EXPIRY_MINUTES * 60 * 1000;

        const filesWithExpiry = files.map(file => {
            const remaining = Math.max(0, (file.uploadTime + expiryMs - now) / 1000);
            return {
                id: file.id,
                originalName: file.originalName,
                generatedName: file.generatedName,
                size: file.sizeText,
                remainingSeconds: Math.floor(remaining),
                remainingText: remaining > 0 ?
                    Math.floor(remaining / 60) + 'm ' + Math.floor(remaining % 60) + 's' :
                    'Expired'
            };
        });

        res.json(filesWithExpiry);
    } catch (error) {
        console.error('List error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/full-stats', (req, res) => {
    try {
        const now = Date.now();
        const expiryMs = FILE_EXPIRY_MINUTES * 60 * 1000;
        const activeFiles = files.filter(f => (now - f.uploadTime) < expiryMs);

        const stats = {
            total: files.length,
            active: activeFiles.length,
            expired: files.length - activeFiles.length,
            images: files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.generatedName)).length,
            videos: files.filter(f => /\.(mp4|webm|mov|mkv)$/i.test(f.generatedName)).length,
            others: files.filter(f => !/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv)$/i.test(f.generatedName)).length,
            totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
            totalSizeText: (files.reduce((sum, f) => sum + (f.size || 0), 0) / 1024 / 1024).toFixed(2) + ' MB'
        };
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/stats-system', (req, res) => {
    try {
        const os = require('os');
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        res.json({
            ramPercent: ((usedMem / totalMem) * 100).toFixed(0),
            ramText: (usedMem / 1024 / 1024 / 1024).toFixed(1) + 'GB / ' + (totalMem / 1024 / 1024 / 1024).toFixed(1) + 'GB',
            platform: os.platform(),
            uptime: (os.uptime() / 3600).toFixed(1) + ' Jam',
            filesInMemory: files.length
        });
    } catch (error) {
        console.error('System stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        if (password === 'zackadmin') {
            res.json({ success: true, token: 'zackadmin' });
        } else {
            res.status(401).json({ success: false, message: 'Password salah' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/delete/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const initialLength = files.length;
        files = files.filter(f => f.generatedName !== filename);

        if (files.length < initialLength) {
            res.json({ success: true, message: 'File dihapus' });
        } else {
            res.status(404).json({ success: false, message: 'File tidak ditemukan' });
        }
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    const file = files.find(f => f.generatedName === filename);

    if (file) {
        const buffer = Buffer.from(file.data, 'base64');
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', 'inline; filename="' + file.originalName + '"');
        res.send(buffer);
    } else {
        res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - File Tidak Ditemukan</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                    background: #f0f2f5;
                }
                .error-card {
                    padding: 40px;
                    max-width: 400px;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                h1 { color: #4A90E2; font-size: 80px; margin: 0; }
                .btn-home {
                    text-decoration: none;
                    background: #4A90E2;
                    color: white;
                    padding: 12px 25px;
                    border-radius: 10px;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h1>404</h1>
                <h3>File Telah Kadaluarsa</h3>
                <p>File ini sudah otomatis dihapus setelah ` + FILE_EXPIRY_MINUTES + ` menit.</p>
                <a href="/" class="btn-home">Kembali ke Beranda</a>
            </div>
        </body>
        </html>
        `);
    }
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
            return res.status(413).json({
                error: 'File terlalu besar! Maksimal 10MB'
            });
        }
        return res.status(400).json({ error: err.message });
    }
    console.error('Global error:', err);
    res.status(500).json({ error: err.message });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log('UploadYuk Running on port ' + PORT);
        console.log('Max file size: 10MB');
        console.log('Auto delete after: 10 minutes');
        console.log('Files stored in memory (RAM)');
    });
        }
