import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRoast } from './asisten.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 6 * 1024 * 1024 } });

// Use CORS middleware
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Roasting route
app.post('/asisten', upload.single('file'), async (req, res, next) => {
    // Timeout handler: Set limit to 10 seconds
    const timeout = setTimeout(() => {
        res.status(504).json({ error: 'Request timed out. Please try again later.' });
    }, 9000); // 10 detik

    try {
        // Validasi file upload
        if (req.fileValidationError) {
            clearTimeout(timeout);
            return res.status(400).json({ error: req.fileValidationError });
        }
        if (!req.file) {
            clearTimeout(timeout);
            return res.status(400).json({ error: 'No image uploaded' });
        }
        if (req.file.size > 6 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(400).json({ error: 'File size exceeds 6MB limit' });
        }

        console.log('Received file:', req.file); // Log informasi file

        // Proses roasting
        const roast = await getRoast(req.file);
        clearTimeout(timeout); // Clear timeout jika berhasil
        res.json({ ok: true, text: roast });
    } catch (error) {
        clearTimeout(timeout); // Clear timeout jika terjadi kesalahan
        console.error('Roasting error:', error);

        // Tangani khusus error timeout
        if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
            return res.status(504).json({
                error: 'Maaf, terjadi timeout. Silakan coba lagi nanti.'
            });
        }

        // Tangani error lainnya
        next(error); // Pass ke middleware error global
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(err.status || 500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Middleware untuk menangani status 504 Gateway Timeout jika belum ter-handle
app.use((req, res, next) => {
    res.on('finish', () => {
        // Jika status code adalah 504, kirimkan respons JSON
        if (res.statusCode === 504) {
            res.json({ error: 'Gateway Timeout', message: 'The server took too long to respond. Please try again later.' });
        }
    });
    next();
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app; // Untuk deployment di Vercel
