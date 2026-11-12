# 📢 Chức Năng Tổng Hợp Thông Báo Từ Nhiều Nguồn (Node.js + PostgreSQL + Flutter)

> **Dự án nhóm môn Công nghệ Phần mềm**  
> **Thành viên phụ trách:** **Nguyễn Hữu Tuấn**  
> **Kiến trúc hệ thống:** Node.js Backend + PostgreSQL + Flutter Mobile/Web + Firebase (FCM & Auth)  
> **Tiến độ hiện tại:** Đã hoàn thành **Task 11** (*Thiết kế Schema CSDL PostgreSQL và cấu trúc API thu thập thông báo*). Các Task 12–15 đang được triển khai theo lộ trình đến Thứ 6 tuần sau.

---

## 📂 Cấu Trúc Mã Nguồn (Task 11)

```text
LamNhomCongNghe/
├── src/
│   ├── db/
│   │   ├── schema.sql                      # Thiết kế Schema PostgreSQL (Bảng, Quan hệ, ENUM, GIN/Composite Index)
│   │   └── postgres.js                     # Tầng Repository kết nối PostgreSQL & xử lý lưu/truy vấn thông báo
│   ├── controllers/
│   │   └── notification.controller.js      # Controller kiểm tra dữ liệu đầu vào & điều phối luồng thu thập
│   ├── api/
│   │   └── notification.routes.js          # Định nghĩa cấu trúc REST API (/api/v1/notifications/...)
│   └── server.js                           # Khởi chạy Node.js Backend Server
└── package.json
```

---

## 🗄️ 1. Thiết Kế Schema Cơ Sở Dữ Liệu PostgreSQL ([`src/db/schema.sql`](src/db/schema.sql))

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

## 🔌 2. Cấu Trúc REST API Thu Thập Thông Báo ([`src/api/notification.routes.js`](src/api/notification.routes.js))

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/notifications/sources` | Lấy danh sách các kênh nguồn thông báo đang hoạt động (Phòng Đào tạo, Khoa, Lớp học phần, Email SV, Ngoại khóa). |
| `POST` | `/api/v1/notifications/collect` | Thu thập 1 thông báo mới từ kênh nguồn, kiểm tra hợp lệ và khử trùng lặp qua `content_hash`. |
| `POST` | `/api/v1/notifications/collect-batch` | Thu thập hàng loạt thông báo từ Crawler hoặc Webhook đa nguồn trong một lần gọi. |
| `GET` | `/api/v1/notifications` | Truy vấn danh sách thông báo có phân trang và lọc theo `source_type`, `scope_type`, `course_code` cho ứng dụng Flutter. |
| `GET` | `/api/v1/notifications/:id` | Lấy chi tiết một thông báo theo `notification_id`. |

### Ví dụ Payload gọi API thu thập thông báo (`POST /api/v1/notifications/collect`)
```json
{
  "external_id": "PDT-2026-101",
  "source_code": "PORTAL_PDT",
  "source_type": "TRAINING_DEPT",
  "title": "Thông báo lịch thi cuối kỳ học kỳ 1 năm học 2026-2027",
  "content": "Phòng Đào tạo thông báo lịch thi cuối kỳ chính thức cho toàn bộ các lớp học phần...",
  "sender_name": "Phòng Đào tạo Đại học",
  "course_code": "IT401",
  "scope_type": "GENERAL",
  "priority": "HIGH",
  "priority_score": 78,
  "tags": ["#LịchThi", "#IT401-CNPM"],
  "source_url": "https://sv.dut.udn.vn/lich-thi-hk1"
}
```
