# imiscarmble

# 📖 WordCraft – Word Unscrambler

> Nhập một từ tiếng Anh bất kỳ, ứng dụng sẽ tự động tìm tất cả các từ hợp lệ có thể tạo ra từ các chữ cái của từ đó – và hiển thị định nghĩa tiếng Anh của từng từ tìm được.

---

## ⚙️ Cách cài đặt

### Yêu cầu

- Trình duyệt hiện đại: **Chrome**, **Edge**, **Firefox**, **Safari** (phiên bản mới)
- Kết nối Internet (tùy chọn – chỉ dùng để lấy định nghĩa từ điển, không bắt buộc)
- **Không cần** Node.js, npm hay bất kỳ công cụ build nào

### Cài đặt

1. **Clone hoặc tải dự án:**

   ```bash
   git clone <repo-url>
   cd word-unscrambler
   ```

   Hoặc đơn giản là **tải về** và giải nén folder.

2. **Mở ứng dụng:**

   Cách 1 – Mở trực tiếp bằng trình duyệt:

   ```
   Double-click vào file: index.html
   ```

   Cách 2 – Dùng Live Server (VS Code extension):

   ```
   Cài extension "Live Server" → Right-click index.html → Open with Live Server
   ```

   Cách 3 – Dùng Python HTTP server (nếu có Python):

   ```bash
   python -m http.server 8080
   # Mở: http://localhost:8080
   ```

---

## 🔌 API sử dụng

### Free Dictionary API

```
Endpoint: https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```
