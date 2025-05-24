import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let keys = JSON.parse(fs.readFileSync("./keys.json", "utf-8"));

let activeSlots = {};
try {
  const raw = fs.readFileSync("./active.json", "utf-8");
  activeSlots = JSON.parse(raw);
  if (Array.isArray(activeSlots)) {
    console.warn("⚠️ active.json đang là mảng [], cần là object {}");
    activeSlots = {};
  }
} catch (err) {
  console.log("Không tìm thấy hoặc lỗi đọc active.json, tạo mới.");
  activeSlots = {};
}

const TIMEOUT_MS = 10 * 60 * 1000;

function getMaxDevices(key) {
  const keyData = keys.find(k => k.key === key);
  return keyData?.maxDevices || 1;
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
    return res.json({ success: false, message: `Đã đạt số lượng thiết bị tối đa (${maxDevices})` });
  }

  activeSlots[key].push(Date.now());

  try {
    fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
    console.log("✅ Đã ghi active.json:", activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi active.json:", err.message);
  }

  res.json({ success: true, message: "Key hợp lệ" });
});

app.post("/release", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  if (!activeSlots[key] || activeSlots[key].length === 0) {
    return res.json({ success: false, message: "Key không có thiết bị nào đang sử dụng" });
  }

  activeSlots[key].shift();

  try {
    fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
    console.log("✅ Đã ghi sau release:", activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi sau release:", err.message);
  }

  res.json({ success: true, message: "Đã giải phóng 1 thiết bị" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại cổng ${PORT}`);
});
