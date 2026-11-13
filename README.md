# 📢 Chức Năng Tổng Hợp Thông Báo Từ Nhiều Nguồn (Node.js + PostgreSQL + Flutter)

> **Dự án nhóm môn Công nghệ Phần mềm**  
> **Thành viên phụ trách:** **Nguyễn Hữu Tuấn**  
> **Kiến trúc hệ thống:** Node.js Backend + PostgreSQL + Flutter Mobile/Web + Firebase (FCM & Auth)  
> **Tiến độ hiện tại:**
> - ✅ **Task 11**: *Thiết kế Schema CSDL PostgreSQL và cấu trúc API thu thập thông báo* (100% Hoàn thành).
> - ✅ **Task 13**: *Phát triển bộ lọc phân loại tin tức & thuật toán gắn nhãn độ ưu tiên* (100% Hoàn thành).

---

## 📂 Cấu Trúc Mã Nguồn

```text
LamNhomCongNghe/
├── src/
│   ├── db/
│   │   ├── schema.sql                      # Thiết kế Schema PostgreSQL (Bảng, Quan hệ, ENUM, GIN/Composite Index)
│   │   └── postgres.js                     # Tầng Repository kết nối PostgreSQL & xử lý lưu/truy vấn thông báo
│   ├── services/
│   │   └── classifier.service.js           # TASK 13: Rules Engine gắn tag môn học, phân loại chung/riêng & tính điểm ưu tiên
│   ├── controllers/
│   │   └── notification.controller.js      # Controller kiểm tra dữ liệu đầu vào, phân loại & điều phối luồng thu thập
│   ├── api/
│   │   └── notification.routes.js          # Định nghĩa cấu trúc REST API (/api/v1/notifications/...)
│   └── server.js                           # Khởi chạy Node.js Backend Server
├── tests/
│   └── classifier.test.js                  # Bộ kiểm thử tự động toàn diện cho Task 13 (Rules Engine)
└── package.json
```

---

## 🗄️ 1. Thiết Kế Schema Cơ Sở Dữ Liệu PostgreSQL ([`src/db/schema.sql`](src/db/schema.sql) - Task 11)

Schema PostgreSQL được thiết kế chuẩn quan hệ để tích hợp đồng bộ với các chức năng khác trong nhóm (Sinh viên, Môn học, Lớp học phần, Firebase Auth/FCM):

1. **`students`**: Lưu thông tin sinh viên (`student_id`, `firebase_uid`, `full_name`, `email`, `faculty_code`).
2. **`courses` & `class_sections` & `student_enrollments`**: Quản lý môn học (`course_code`, `course_tag`), lớp học phần và danh sách sinh viên đăng ký học phần.
3. **`notification_sources`**: Quản lý 5 nhóm kênh nguồn thu thập thông báo (`TRAINING_DEPT` - Phòng Đào tạo, `FACULTY` - Khoa, `CLASS_SECTION` - Lớp học phần, `STUDENT_EMAIL` - Email sinh viên, `EXTRACURRICULAR` - Ngoại khóa/CLB).
4. **`notifications`**: Bảng trung tâm lưu thông báo thu thập được, tích hợp:
   - Khoá ngoại tới `notification_sources`, `courses`, `class_sections`, `students`.
   - Phân loại phạm vi `scope_type` (`GENERAL`, `CLASS`, `PERSONAL`) và mức độ ưu tiên `priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
   - Trường `tags` và `attachments` kiểu `JSONB` (kèm `GIN Index`) và `content_hash` (`CHAR(64)` SHA-256 `UNIQUE`) chống trùng lặp dữ liệu khi cào đa nguồn.
5. **`student_notifications`**: Bảng quan hệ lưu trạng thái nhận tin, đã đọc (`is_read`, `read_at`), ghim tin (`is_pinned`) và trạng thái đẩy FCM (`fcm_sent`) của từng sinh viên.
6. **`ingestion_logs`**: Lưu lịch sử các phiên thu thập dữ liệu từ các kênh nguồn.

---

## 🧠 2. Bộ Quy Tắc (Rules Engine) Phân Loại & Gắn Nhãn ([`src/services/classifier.service.js`](src/services/classifier.service.js) - Task 13)

Module Rules Engine tự động thực thi 3 cơ chế phân loại độc lập và kết hợp:

### A. Tự động nhận diện môn học & gắn tag môn học (`detectCourseTag`)
- Tự động quét đối soát tiêu đề, nội dung và mã môn học theo danh mục môn học (`DEFAULT_COURSES`) và Regex mã môn (`/\b([a-z]{2,4}\d{3}[a-z]?)\b/i`).
- Gắn định dạng tag chuẩn cho Flutter UI:
  - Công nghệ phần mềm / IT401 -> `course_code: 'IT401'`, `course_tag: '#IT401-CNPM'`
  - Cơ sở dữ liệu / IT302 -> `course_code: 'IT302'`, `course_tag: '#IT302-CSDL'`
  - Trí tuệ nhân tạo / IT408 -> `course_code: 'IT408'`, `course_tag: '#IT408-AI'`
  - Mạng máy tính / IT205 -> `course_code: 'IT205'`, `course_tag: '#IT205-MMT'`
  - Lập trình di động / IT305 -> `course_code: 'IT305'`, `course_tag: '#IT305-Mobile'`

### B. Phân loại phạm vi thông báo Chung / Lớp học phần / Riêng cá nhân (`detectScopeType`)
1. **`PERSONAL` (Riêng cá nhân)**:
   - Phát hiện MSSV sinh viên (`target_student_id`, regex `102xxxxxxx`) hoặc các cụm từ: *nhắc nợ học phí cá nhân, cảnh báo học vụ sinh viên, kết quả phúc khảo, hồ sơ cá nhân*.
   - Tự động gắn tag `#TinRiêng`.
2. **`CLASS` (Lớp học phần)**:
   - Thuộc kênh `CLASS_SECTION`, có `course_code` hoặc chứa từ khóa: *lớp học phần, đổi phòng học, lịch học bù, bài tập lớn, nộp báo cáo đồ án, thực hành*.
   - Tự động gắn tag `#LớpHọcPhần`.
3. **`GENERAL` (Thông báo chung)**:
   - Các thông báo mở rộng toàn trường/khoa: *kế hoạch đào tạo chung, nghỉ lễ/tết, quy chế sinh viên, học bổng trường*.
   - Tự động gắn tag `#ThôngBáoChung`.

### C. Thuật toán tính điểm ưu tiên đa trọng số & gắn nhãn độ quan trọng (`classifyNotification`)
Công thức tính điểm ưu tiên (`priority_score` trong khoảng `[10, 100]`):
$$\text{Priority Score} = \text{Base Weight (Nguồn)} + \text{Scope Weight (Phạm vi)} + \sum \text{Rule Weight (Từ khóa)} + \text{Urgency Bonus}$$

- **Trọng số nguồn gửi (`SOURCE_BASE_WEIGHTS`)**:
  - `TRAINING_DEPT`: +30 | `FACULTY`: +25 | `CLASS_SECTION`: +25 | `STUDENT_EMAIL`: +22 | `EXTRACURRICULAR`: +10
- **Trọng số phạm vi (`SCOPE_WEIGHTS`)**:
  - `PERSONAL`: +20 | `CLASS`: +12 | `GENERAL`: +5
- **Bộ quy tắc từ khóa theo chủ đề (`PRIORITY_RULES`)**:
  - *Khẩn cấp / Hoãn thi / Nghỉ bão đột xuất*: +42 điểm -> Tag `#KhẩnCấp`
  - *Lịch thi / Phòng thi / Bảo vệ đồ án*: +30 điểm -> Tag `#LịchThi`
  - *Học phí / Nợ học phí / Gia hạn*: +28 điểm -> Tag `#HọcPhí`
  - *Lịch học / Đổi phòng / Học bù*: +25 điểm -> Tag `#LịchHọc`
  - *Bài tập / Deadline / Hạn chót*: +22 điểm -> Tag `#BàiTập`
  - *Học bổng / Khuyến khích*: +14 điểm -> Tag `#HọcBổng`
  - *Ngoại khóa / Giao lưu CLB*: -6 điểm -> Tag `#NgoạiKhóa`
- **Yếu tố thời gian khẩn cấp (`URGENCY_TIME_KEYWORDS`)**:
  - Chứa *"hôm nay", "ngay lập tức", "trước 17h", "trong vòng 24h", "gấp"*: +12 điểm -> Tag `#Gấp`
- **Quy đổi nhãn cấp độ ưu tiên**:
  - `priority_score >= 80` -> **`URGENT`** (Khẩn cấp)
  - `60 <= priority_score < 80` -> **`HIGH`** (Ưu tiên cao)
  - `40 <= priority_score < 60` -> **`MEDIUM`** (Trung bình)
  - `priority_score < 40` -> **`LOW`** (Thấp)

---

## 🔌 3. Danh Sách REST API Endpoints ([`src/api/notification.routes.js`](src/api/notification.routes.js))

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/v1/notifications/sources` | Lấy danh sách 5 kênh nguồn thu thập thông báo. |
| `GET` | `/api/v1/notifications/rules` | **(Task 13)** Tra cứu danh mục quy tắc, trọng số và danh sách từ khóa của Rules Engine. |
| `POST` | `/api/v1/notifications/classify` | **(Task 13)** Thử nghiệm & xem trước phân loại (gắn tag, chung/lớp/riêng, điểm ưu tiên) mà không cần lưu CSDL. |
| `POST` | `/api/v1/notifications/collect` | Thu thập 1 thông báo mới (tự động chạy qua Rules Engine nếu chưa phân loại). |
| `POST` | `/api/v1/notifications/collect-batch` | Thu thập lô thông báo từ Crawler/Webhook (tự động chạy qua Rules Engine). |
| `GET` | `/api/v1/notifications` | Lấy danh sách thông báo đã thu thập (hỗ trợ phân trang, lọc theo nguồn, phạm vi, môn học). |
| `GET` | `/api/v1/notifications/:id` | Xem chi tiết 1 thông báo. |

---

## 🧪 4. Hướng Dẫn Chạy & Kiểm Thử Tự Động

### Chạy Unit Test kiểm tra toàn bộ Rules Engine (Task 13)
```bash
npm test
```

### Khởi chạy Server Backend
```bash
npm start
```
Server chạy tại: `http://localhost:3000` (hoặc cổng được cấu hình qua biến môi trường `PORT`).
