// server.js
const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

const keysPath = path.join(__dirname, 'keys.json')
const activePath = path.join(__dirname, 'active.json')

// Helper to read/write JSON
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// Endpoint: /validate
app.post('/validate', (req, res) => {
  const { key } = req.body
  if (!key) return res.json({ success: false, message: 'Thiếu key' })

  const keys = readJSON(keysPath)
  const active = readJSON(activePath)

  const found = keys.find(k => k.key === key)
  if (!found) return res.json({ success: false, message: 'Key không tồn tại' })

  const now = new Date()
  const expiry = new Date(found.expiry)
  if (now > expiry) return res.json({ success: false, message: 'Key đã hết hạn' })

  const count = active.filter(k => k === key).length
  const maxDevices = 1  // Số thiết bị tối đa

  if (count >= maxDevices)
    return res.json({ success: false, message: 'Key đã được dùng ở thiết bị khác' })

  active.push(key)
  writeJSON(activePath, active)
  return res.json({ success: true, message: 'Key hợp lệ' })
})

// Endpoint: /release
app.post('/release', (req, res) => {
  const { key } = req.body
  if (!key) return res.json({ success: false })

  let active = readJSON(activePath)
  const originalLength = active.length
  active = active.filter(k => k !== key)

  if (active.length !== originalLength) {
    writeJSON(activePath, active)
    return res.json({ success: true })
  } else {
    return res.json({ success: false })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
