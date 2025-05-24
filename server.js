import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let keys;
try {
  keys = JSON.parse(fs.readFileSync(path.resolve("./keys.json"), "utf-8"));
  console.log("✅ Đã load keys.json");
} catch (e) {
  console.error("❌ Lỗi đọc keys.json:", e.message);
  process.exit(1);
}

let activeSlots = {};
const activeFilePath = path.resolve("./active.json");
try {
  const raw = fs.readFileSync(activeFilePath, "utf-8");
  activeSlots = JSON.parse(raw);
  if (Array.isArray(activeSlots)) {
    console.warn("⚠️ active.json đang là mảng [], cần là object {}");
    activeSlots = {};
  }
  console.log("✅ Đã load active.json");
} catch (e) {
  console.log("⚠️ Không tìm thấy hoặc lỗi đọc active.json, tạo mới.");
  activeSlots = {};
}

const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút timeout

function cleanInactiveSlots() {
  const now = Date.now();
  for (const key in activeSlots) {
    activeSlots[key] = activeSlots[key].filter(timestamp => (now - timestamp) <= TIMEOUT_MS);
    if (activeSlots[key].length === 0) {
      delete activeSlots[key];
    }
  }
  try {
    fs.writeFileSync(activeFilePath, JSON.stringify(activeSlots, null, 2));
    console.log("✅ Đã ghi active.json sau khi clean:", activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi active.json trong cleanInactiveSlots:", err.message);
  }
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

  cleanInactiveSlots();

  if (activeSlots[key] && activeSlots[key].length > 0) {
    return res.json({ success: false, message: "Đã có thiết bị khác đang sử dụng key" });
  }

  activeSlots[key] = [Date.now()];

  try {
    fs.writeFileSync(activeFilePath, JSON.stringify(activeSlots, null, 2));
    console.log("✅ Đã ghi active.json sau validate:", activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi active.json sau validate:", err.message);
    return res.json({ success: false, message: "Lỗi ghi file active.json" });
  }

  return res.json({ success: true, message: "Key hợp lệ và được kích hoạt" });
});

app.post("/release", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  if (!activeSlots[key] || activeSlots[key].length === 0) {
    return res.json({ success: false, message: "Key không có thiết bị nào đang sử dụng" });
  }

  delete activeSlots[key];

  try {
    fs.writeFileSync(activeFilePath, JSON.stringify(activeSlots, null, 2));
    console.log("✅ Đã ghi active.json sau release:", activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi active.json sau release:", err.message);
    return res.json({ success: false, message: "Lỗi ghi file active.json" });
  }

  return res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});
