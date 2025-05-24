import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Đọc file keys.json (giữ nguyên cấu trúc cũ)
let keys = JSON.parse(fs.readFileSync("./keys.json", "utf-8"));

// active.json lưu trạng thái thiết bị active của từng key
let activeDevices = {};
try {
  activeDevices = JSON.parse(fs.readFileSync("./active.json", "utf-8"));
} catch {
  activeDevices = {};
}

// Hàm lấy maxDevices mặc định 1 nếu không có trong keys.json
function getMaxDevices(key) {
  const keyData = keys.find(k => k.key === key);
  if (!keyData) return 0;
  return keyData.maxDevices || 1;
}

// API kiểm tra key và đăng ký thiết bị
app.post("/validate", (req, res) => {
  const { key, deviceId } = req.body;
  if (!key || !deviceId) return res.json({ success: false, message: "Thiếu key hoặc deviceId" });

  const keyData = keys.find(k => k.key === key);
  if (!keyData) return res.json({ success: false, message: "Key không tồn tại" });

  // Kiểm tra ngày hết hạn (nếu có)
  if (keyData.expiry && new Date(keyData.expiry) < new Date()) {
    return res.json({ success: false, message: "Key đã hết hạn" });
  }

  // Lấy số thiết bị tối đa được phép dùng
  const maxDevices = getMaxDevices(key);

  if (!activeDevices[key]) activeDevices[key] = [];

  // Nếu thiết bị đã đăng ký rồi thì cứ cho qua
  if (activeDevices[key].includes(deviceId)) {
    return res.json({ success: true, message: "Key hợp lệ" });
  }

  // Nếu số thiết bị đã đạt max thì từ chối
  if (activeDevices[key].length >= maxDevices) {
    return res.json({ success: false, message: `Đã đạt số lượng thiết bị tối đa (${maxDevices})` });
  }

  // Đăng ký thiết bị mới
  activeDevices[key].push(deviceId);
  fs.writeFileSync("./active.json", JSON.stringify(activeDevices, null, 2));

  res.json({ success: true, message: "Key hợp lệ" });
});

// API release thiết bị khi thoát
app.post("/release", (req, res) => {
  const { key, deviceId } = req.body;
  if (!key || !deviceId) return res.json({ success: false, message: "Thiếu key hoặc deviceId" });

  if (!activeDevices[key]) return res.json({ success: false, message: "Key không tồn tại hoặc không có thiết bị đăng ký" });

  activeDevices[key] = activeDevices[key].filter(id => id !== deviceId);

  fs.writeFileSync("./active.json", JSON.stringify(activeDevices, null, 2));

  res.json({ success: true, message: "Thiết bị đã được giải phóng" });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
