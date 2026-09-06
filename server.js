import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import generateHandler from './generate.js';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.post('/api/generate', generateHandler);
app.all('/api/generate', generateHandler);

app.post('/api/chat', chatHandler);
app.all('/api/chat', chatHandler);

// Static assets
app.use(express.static(__dirname));

// Single Page Application fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
