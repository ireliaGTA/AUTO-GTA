import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Load keys từ file keys.json (vẫn đọc file này)
let keys;
try {
  keys = JSON.parse(fs.readFileSync("./keys.json", "utf-8"));
} catch (err) {
  console.error("❌ Lỗi đọc keys.json:", err);
  process.exit(1);
}

// Lưu activeSlots trên RAM, khởi tạo trống
let activeSlots = {};

// Timeout cho slot (vd: 10 phút)
const TIMEOUT_MS = 10 * 60 * 1000;

function cleanInactiveSlots() {
  const now = Date.now();
  for (const key in activeSlots) {
    activeSlots[key] = activeSlots[key].filter(ts => (now - ts) <= TIMEOUT_MS);
    if (activeSlots[key].length === 0) {
      delete activeSlots[key];
    }
  }
}

// Dọn inactive slots mỗi 5 phút
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

  // Giới hạn 1 thiết bị dùng cùng key
  if (activeSlots[key] && activeSlots[key].length > 0) {
    return res.json({ success: false, message: "Đã có thiết bị khác đang sử dụng key" });
  }

  activeSlots[key] = [Date.now()];

  return res.json({ success: true, message: "Key hợp lệ và được kích hoạt" });
});

app.post("/release", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  if (!activeSlots[key] || activeSlots[key].length === 0) {
    return res.json({ success: false, message: "Key không có thiết bị nào đang sử dụng" });
  }

  delete activeSlots[key];

  return res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});
