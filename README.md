# 📢 MVP Chức Năng Tổng Hợp Thông Báo Từ Nhiều Nguồn

> **Dự án nhóm môn Công nghệ Phần mềm**  
> **Thành viên thực hiện:** **Nguyễn Hữu Tuấn**  
> **Phạm vi phụ trách:** Task 11, Task 12, Task 13, Task 14, Task 15 (Tổng thời lượng ước tính: **8h**)

---

## 📋 Bảng Ánh Xạ 5 Task Của Nguyễn Hữu Tuấn Trong MVP

| No | Tên Task | Chi tiết thực hiện | File / Module tương ứng | Ước lượng (h) | Trạng thái |
|:--:|---|---|---|:---:|:---:|
| **11** | **Thiết kế Schema cơ sở dữ liệu và cấu trúc API thu thập thông báo** | Thiết kế các bảng `notification_sources`, `courses`, `notifications`, `ingestion_logs` lưu trữ thông báo từ Phòng Đào tạo, Khoa, Lớp học phần, Email sinh viên và Kênh ngoại khóa; xây dựng REST API chuẩn thu thập & truy vấn. | [`src/db/schema.sql`](src/db/schema.sql)<br>[`src/db/database.js`](src/db/database.js)<br>[`src/api/router.js`](src/api/router.js) | 2.0h | ✅ Hoàn thành |
| **12** | **Xây dựng module tự động cào/tổng hợp thông báo từ các kênh nguồn** | Lập trình Crawler bóc tách HTML từ Portal nhà trường/Khoa (`parsePortalHtml`), bóc tách Email sinh viên MIME/Webhook (`parseStudentEmail`), tiếp nhận Webhook đa kênh và đồng bộ song song có khử trùng lặp SHA-256 (`crawlAllSources`). | [`src/services/crawlerService.js`](src/services/crawlerService.js) | 2.0h | ✅ Hoàn thành |
| **13** | **Phát triển bộ lọc phân loại tin tức & thuật toán gắn nhãn độ ưu tiên** | Xây dựng bộ quy tắc (rules) tự động nhận diện mã môn học (`#IT401-CNPM`, `#IT302-CSDL`, `#IT408-AI`...), phân loại phạm vi thông báo (`GENERAL` Chung / `CLASS` Lớp / `PERSONAL` Riêng) và chấm điểm ưu tiên đa trọng số (`0-100` → `URGENT`, `HIGH`, `MEDIUM`, `LOW`). | [`src/services/classifierService.js`](src/services/classifierService.js) | 1.5h | ✅ Hoàn thành |
| **14** | **Thiết kế giao diện (UI) bảng tin thông báo tập trung** | Xây dựng giao diện Feed tập trung trực quan, hỗ trợ tìm kiếm từ khóa thời gian thực, lọc đa chiều (theo nguồn, độ ưu tiên, phạm vi Chung/Riêng, môn học, trạng thái đọc), phân trang, kèm công cụ thử nghiệm Crawler/Webhook trực tiếp trên UI. | [`public/index.html`](public/index.html)<br>[`public/styles.css`](public/styles.css)<br>[`public/app.js`](public/app.js) | 1.5h | ✅ Hoàn thành |
| **15** | **Kiểm thử luồng tích hợp dữ liệu đa nguồn và tối ưu hiệu năng lấy tin** | Tối ưu hóa tốc độ ghi hàng loạt bằng SQLite Transaction (`BEGIN IMMEDIATE`), đánh Composite Indexes, tích hợp bộ nhớ đệm `In-Memory LRU/TTL Cache` và viết bộ Unit/Integration/Load Test kiểm thử đồng thời 500–1,000 bản ghi đa nguồn. | [`src/services/cacheService.js`](src/services/cacheService.js)<br>[`tests/notification.test.js`](tests/notification.test.js)<br>[`src/scripts/benchmark.js`](src/scripts/benchmark.js) | 1.0h | ✅ Hoàn thành |

---

## 🏗️ Kiến Trúc Thư Mục

```text
LamNhomCongNghe/
├── public/
│   ├── index.html                  # Giao diện Bảng tin thông báo tập trung (Task 14)
│   ├── styles.css                  # CSS Responsive Desktop/Mobile (Task 14)
│   └── app.js                      # Xử lý Tìm kiếm, Bộ lọc, Phân trang & Đồng bộ UI (Task 14)
├── src/
│   ├── api/
│   │   └── router.js               # Định nghĩa các Endpoint REST API (Task 11)
│   ├── db/
│   │   ├── schema.sql              # Thiết kế Database Schema & Indexes (Task 11 & 15)
│   │   └── database.js             # Quản lý SQLite, Batch Insert & Truy vấn phân trang (Task 11 & 15)
│   ├── scripts/
│   │   └── benchmark.js            # Script đo hiệu năng tích hợp 1,000 tin đa nguồn (Task 15)
│   ├── services/
│   │   ├── crawlerService.js       # Module Crawler HTML Portal, Email SV & Webhook (Task 12)
│   │   ├── classifierService.js    # Bộ quy tắc phân loại & Thuật toán tính điểm ưu tiên (Task 13)
│   │   └── cacheService.js         # Bộ nhớ đệm In-Memory LRU/TTL Cache (Task 15)
│   └── server.js                   # HTTP Server khởi chạy ứng dụng
├── tests/
│   └── notification.test.js        # Bộ kiểm thử tự động toàn diện cho 5 Task (Task 15)
└── package.json
```

---

## 🔌 Danh Sách REST API (Task 11)

| Phương thức | Endpoint | Mô tả chức năng |
|---|---|---|
| `GET` | `/api/notifications` | Truy vấn bảng tin tập trung (hỗ trợ `q`, `source_type`, `priority`, `scope_type`, `course_code`, `is_read`, `page`, `limit`). |
| `GET` | `/api/notifications/stats` | Thống kê số lượng thông báo theo kênh nguồn, độ ưu tiên, môn học và tỉ lệ Cache Hit. |
| `GET` | `/api/notifications/:id` | Lấy chi tiết một thông báo theo ID. |
| `POST` | `/api/notifications` | Thu thập 1 thông báo mới, tự động chạy qua bộ phân loại & gắn nhãn độ ưu tiên. |
| `PATCH` | `/api/notifications/:id/read` | Đánh dấu đã đọc / chưa đọc cho một thông báo. |
| `PATCH` | `/api/notifications/read-all` | Đánh dấu đã đọc toàn bộ thông báo. |
| `POST` | `/api/ingest/webhook` | Webhook tiếp nhận thông báo từ hệ thống ngoài (hỗ trợ JSON, Raw Email MIME hoặc HTML Portal). |
| `POST` | `/api/ingest/crawl` | Kích hoạt Crawler thu thập đồng thời từ tất cả kênh nguồn (Portal Phòng Đào tạo, Khoa, Lớp học phần, Email SV, Ngoại khóa). |
| `POST` | `/api/classify/preview` | API kiểm thử nhanh bộ lọc phân loại & tính điểm ưu tiên cho văn bản bất kỳ. |
| `GET` | `/api/ingest/logs` | Xem lịch sử và thời gian thực thi (`ms`) của các phiên đồng bộ dữ liệu. |

---

## 🚀 Hướng Dẫn Chạy & Kiểm Thử

Yêu cầu: **Node.js >= 22** (sử dụng trực tiếp `node:sqlite`, `node:http`, `node:test` tích hợp sẵn, không cần cài đặt thư viện ngoài).

### 1. Chạy bộ kiểm thử tự động (Unit + Integration + Load Test - Task 15)
```bash
npm test
```

### 2. Chạy đo kiểm hiệu năng (Benchmark 1,000 bản ghi đa nguồn - Task 15)
```bash
npm run benchmark
```

### 3. Khởi chạy Server & Giao diện Bảng tin Web UI (Task 14)
```bash
npm start
```
Sau đó mở trình duyệt tại địa chỉ: **`http://localhost:3000`**
