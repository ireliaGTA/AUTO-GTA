import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const KEYS_FILE = './keys.json';

function loadKeys() {
  return JSON.parse(fs.readFileSync(KEYS_FILE));
}

app.post('/validate', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ success: false, message: 'Key missing' });

  const keys = loadKeys();
  const userKey = keys.find(k => k.key === key);

  if (!userKey) {
    return res.json({ success: false, message: 'Key not found' });
  }

  const now = new Date();
  const expiry = new Date(userKey.expiry);

  if (now > expiry) {
    return res.json({ success: false, message: 'Key expired' });
  }

  res.json({ success: true, message: 'Valid key', expires: userKey.expiry });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Key server running on port ${PORT}`);
});