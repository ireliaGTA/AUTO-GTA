import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let keys = JSON.parse(fs.readFileSync("./keys.json", "utf-8"));

let activeSlots = {};
try {
  activeSlots = JSON.parse(fs.readFileSync("./active.json", "utf-8"));
} catch {
  activeSlots = {};
}

const TIMEOUT_MS = 10 * 60 * 1000;

function getMaxDevices(key) {
  const keyData = keys.find(k => k.key === key);
  if (!keyData) return 0;
  return keyData.maxDevices || 1;
}

function cleanInactiveSlots() {
  const now = Date.now();
  for (const key in activeSlots) {
    activeSlots[key] = activeSlots[key].filter(timestamp => (now - timestamp) <= TIMEOUT_MS);
  }
  fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
}

setInterval(cleanInactiveSlots, 5 * 60 * 1000);

app.post("/validate", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  const keyData = keys.find(k => k.key === key);
  if (!keyData) return res.json({ success: false, message: "Key không tồn tại" });

  if (keyData.expiry && new Date(keyData.expiry) < new Date()) {
    return res.json({ success: false, message: "Key đã hết hạn" });
  }

  const maxDevices = getMaxDevices(key);
  if (!activeSlots[key]) activeSlots[key] = [];

  cleanInactiveSlots();

  if (activeSlots[key].length >= maxDevices) {
    // Dùng backtick cho template string
    return res.json({ success: false, message: `Đã đạt số lượng thiết bị tối đa (${maxDevices})` });
  }

  activeSlots[key].push(Date.now());
  fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));

  res.json({ success: true, message: "Key hợp lệ" });
});

app.post("/release", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  if (!activeSlots[key]) return res.json({ success: false, message: "Key không tồn tại hoặc không có thiết bị đăng ký" });

  activeSlots[key].shift();
  fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));

  res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
