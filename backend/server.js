import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';
import { model } from './gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const upload = multer({ dest: uploadsDir });

app.use(cors({ origin: '*' }));

console.log('Gemini Key Loaded:', process.env.GEMINI_API_KEY ? 'YES' : 'NO');

const prompt = `
Return only JSON:
{
  "object_type": "item name",
  "color": "main color"
}
`;

app.post('/api/upload-item', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image is required' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase is not configured' });
  }
  if (!model) {
    return res.status(500).json({ error: 'Gemini model not configured (missing API key?)' });
  }

  try {
    const imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType: req.file.mimetype } },
      { text: prompt },
    ]);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const tags = JSON.parse(text);

    const { data, error } = await supabase
      .from('items')
      .insert([{ object_type: tags.object_type, color: tags.color }])
      .select();

    if (error) throw error;
    res.json({ success: true, item: data?.[0] });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Backend running on port ${port}`));
