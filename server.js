import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const keys = [
  { key: "1234", expiry: null },
  { key: "abcd", expiry: "2099-12-31" },
  // Thêm key thật của bạn vào đây hoặc load từ file keys.json
];

// activeSlots lưu dạng { key: timestampLastActive }
const activeSlots = {};
const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

// Dọn các slot timeout
function cleanInactiveSlots() {
  const now = Date.now();
  for (const key in activeSlots) {
    if ((now - activeSlots[key]) > TIMEOUT_MS) {
      delete activeSlots[key];
    }
  }
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

  if (activeSlots[key]) {
    return res.json({ success: false, message: "Đã có thiết bị khác đang sử dụng key" });
  }

  activeSlots[key] = Date.now();

  return res.json({ success: true, message: "Key hợp lệ và được kích hoạt" });
});

app.post("/release", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ success: false, message: "Thiếu key" });

  if (!activeSlots[key]) {
    return res.json({ success: false, message: "Key không có thiết bị nào đang sử dụng" });
  }

  delete activeSlots[key];
  return res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
