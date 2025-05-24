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
} catch {
  activeSlots = {};
}

const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút timeout

// Hàm dọn các key hết hạn slot (nếu lâu không gửi heartbeat)
function cleanInactiveSlots() {
  const now = Date.now();
  for (const key in activeSlots) {
    activeSlots[key] = activeSlots[key].filter(timestamp => (now - timestamp) <= TIMEOUT_MS);
    // Nếu mảng trống thì xóa key đó luôn cho gọn
    if (activeSlots[key].length === 0) {
      delete activeSlots[key];
    }
  }
  fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));
}

setInterval(cleanInactiveSlots, 5 * 60 * 1000); // 5 phút dọn 1 lần

app.post("/validate", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  const keyData = keys.find(k => k.key === key);
  if (!keyData) return res.json({ success: false, message: "Key không tồn tại" });

  if (keyData.expiry && new Date(keyData.expiry) < new Date()) {
    return res.json({ success: false, message: "Key đã hết hạn" });
  }

  cleanInactiveSlots();

  // Nếu đã có 1 thiết bị dùng key (1 timestamp trong activeSlots[key]) thì từ chối
  if (activeSlots[key] && activeSlots[key].length > 0) {
    return res.json({ success: false, message: "Đã có thiết bị khác đang sử dụng key" });
  }

  // Chưa có thiết bị nào dùng key, cho phép và ghi thời gian hiện tại
  activeSlots[key] = [Date.now()];

  fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));

  return res.json({ success: true, message: "Key hợp lệ và được kích hoạt" });
});

app.post("/release", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  if (!activeSlots[key] || activeSlots[key].length === 0) {
    return res.json({ success: false, message: "Key không có thiết bị nào đang sử dụng" });
  }

  // Xóa timestamp (release slot)
  delete activeSlots[key];

  fs.writeFileSync("./active.json", JSON.stringify(activeSlots, null, 2));

  return res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
