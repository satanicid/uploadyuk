const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
        res.status(404).send('File Not Found');
    }
});

app.listen(PORT, () => {
    console.log(`UploadYuk Backend Running on port ${PORT}`);
});
