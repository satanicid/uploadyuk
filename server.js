const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os'); 
const crypto = require('crypto');

const app = express();
const PORT = 3000;

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

const generateRandomCode = (length) => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        const randomCode = generateRandomCode(5);
        const extension = path.extname(file.originalname);
        cb(null, randomCode + extension);
    }
});

const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

const dbPath = './data/database.json';
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]));
}

app.post('/api/v1/upload', upload.single('media'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = JSON.parse(fs.readFileSync(dbPath));
    const fileData = {
        id: Date.now(),
        originalName: req.file.originalname,
        generatedName: req.file.filename,
        url: `${req.protocol}://${req.get('host')}/${req.file.filename}`
    };

    db.push(fileData);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    res.json(fileData);
});


app.get('/api/admin/full-stats', (req, res) => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    const stats = {
        total: db.length,
        images: db.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.generatedName)).length,
        videos: db.filter(f => /\.(mp4|webm|mov|mkv)$/i.test(f.generatedName)).length,
        others: db.filter(f => !/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv)$/i.test(f.generatedName)).length
    };
    res.json(stats);
});


// API Hapus File
app.delete('/api/admin/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    // Hapus dari database.json
    let db = JSON.parse(fs.readFileSync(dbPath));
    db = db.filter(f => f.generatedName !== filename);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    // Hapus file dari folder uploads
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'File dihapus' });
    } else {
        res.status(404).json({ success: false, message: 'File tidak ditemukan' });
    }
});

app.get('/api/admin/stats-system', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Simulasi storage (karena Railway volume dibaca via mount path)
    res.json({
        ramPercent: ((usedMem / totalMem) * 100).toFixed(0),
        ramText: `${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)}GB`,
        platform: os.platform(),
        uptime: (os.uptime() / 3600).toFixed(1) + ' Jam'
    });
});



app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'zackadmin') {
        res.json({ success: true, token: 'zackadmin' });
    } else {
        res.status(401).json({ success: false, message: 'Password salah' });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


app.get('/api/list', (req, res) => {
    const db = JSON.parse(fs.readFileSync(dbPath));
    res.json(db);
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Tidak Ditemukan — UploadYuk</title>
            <style>
                :root { --sky-blue: #87CEEB; --deep-blue: #4A90E2; --text: #2c3e50; }
                body { 
                    font-family: 'Inter', -apple-system, sans-serif; 
                    background: #fdfdfd; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh; 
                    margin: 0; 
                    text-align: center;
                }
                .error-card { padding: 40px; max-width: 400px; width: 90%; }
                h1 { color: var(--deep-blue); font-size: 80px; margin: 0; }
                p { color: #7f8c8d; margin-bottom: 30px; }
                .btn-home { 
                    text-decoration: none; 
                    background: var(--deep-blue); 
                    color: white; 
                    padding: 12px 25px; 
                    border-radius: 10px; 
                    font-weight: 600;
                    box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);
                    transition: 0.3s;
                }
                .btn-home:hover { transform: translateY(-3px); opacity: 0.9; }
                img { width: 150px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="error-card">
                <img src="https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnU4eXZoY3M0eXN3eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/H54feNXf6i4eAQubud/giphy.gif" alt="404 Not Found">
                <h1>404</h1>
                <h3>Waduh! File Hilang</h3>
                <p>Maaf, file yang kamu cari tidak ada di server kami atau sudah dihapus.</p>
                <a href="/" class="btn-home">Kembali ke Beranda</a>
            </div>
        </body>
        </html>
        `);
    }
});


app.listen(PORT, () => {
    console.log(`UploadYuk Backend Running on port ${PORT}`);
});
