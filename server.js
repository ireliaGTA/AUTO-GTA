import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let keys;
try {
  keys = JSON.parse(fs.readFileSync("./keys.json", "utf-8"));
} catch (err) {
  console.error("❌ Lỗi đọc keys.json:", err);
  process.exit(1);
}

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

const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

function cleanInactiveSlots() {
  const now = Date.now();
  let changed = false;
  for (const key in activeSlots) {
    const beforeLen = activeSlots[key].length;
    activeSlots[key] = activeSlots[key].filter(ts => (now - ts) <= TIMEOUT_MS);
    if (activeSlots[key].length === 0) {
      delete activeSlots[key];
      changed = true;
    } else if (activeSlots[key].length !== beforeLen) {
      changed = true;
    }
  }
  if (changed) {
    try {
      fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
      console.log("✅ Đã dọn và ghi lại active.json:", activeSlots);
    } catch (err) {
      console.error("❌ Lỗi ghi active.json khi dọn:", err);
    }
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
    fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
    console.log(`✅ Đã ghi active.json sau khi validate key "${key}"`, activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi active.json:", err);
    return res.json({ success: false, message: "Lỗi server khi ghi active.json" });
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
    fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
    console.log(`✅ Đã ghi active.json sau khi release key "${key}"`, activeSlots);
  } catch (err) {
    console.error("❌ Lỗi ghi active.json khi release:", err);
    return res.json({ success: false, message: "Lỗi server khi ghi active.json" });
  }

  return res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});
