# 🎓 DUT Smart Campus System: Quản Lý Hạn Chót Bài Tập & Thông Báo Đa Nguồn

> **Dự án môn Công nghệ Phần mềm**  
> **Kiến trúc hệ thống:** Node.js Backend + PostgreSQL + Flutter Mobile/Web + Firebase (FCM / Auth)  

---

## 📌 Bảng Phân Công & Tiến Độ Các Task

| No | Task | Phụ trách | Tiến độ | Mô tả chi tiết |
|:---:|:---|:---|:---:|:---|
| **1** | Thiết kế UI danh sách hạn chót & bộ lọc theo môn học | Nguyễn Hữu Duy Bảo | **100%** | Wireframe & Flutter Mobile App + Web UI responsive, lọc môn học & trạng thái |
| **2** | Thiết kế Database Schema lưu trữ deadline & môn học | Nguyễn Hữu Duy Bảo | **100%** | Bảng `deadlines`, `courses` & ENUM `deadline_status_type` |
| **3** | Xây dựng API CRUD quản lý hạn chót (thêm, sửa, xóa) | Nguyễn Hữu Duy Bảo | **100%** | Các endpoint REST API GET, POST, PUT, DELETE |
| **4** | Phân loại trạng thái deadline & tick hoàn thành bài tập | Nguyễn Hữu Duy Bảo | **100%** | Tự động tính Overdue, Due Soon, Upcoming; checkbox toggle thời gian thực |
| **5** | Kiểm thử chức năng (Unit Test) & tối ưu responsive | Nguyễn Hữu Duy Bảo | **100%** | Bộ 17 unit tests tự động (`tests/deadline.test.js`), kiểm tra responsive |
| **6** | Tích hợp Push Notification (FCM/APNs) & lưu Token DB | Hồ Đăng Hùng | **100%** | Bảng `user_device_tokens`, lưu token thiết bị & mock FCM push |
| **11**| Thiết kế Schema CSDL & API thu thập thông báo đa nguồn | Nguyễn Hữu Tuấn | **100%** | Bảng `notifications`, đa nguồn PDT, Khoa, Lớp, Email |
| **13**| Phát triển bộ lọc phân loại tin tức & gắn nhãn ưu tiên | Nguyễn Hữu Tuấn | **100%** | Rules engine tự động gắn tag môn học, phân loại chung/riêng, tính điểm ưu tiên |

---

## 🚀 Hướng Dẫn Khởi Chạy & Kiểm Thử

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Chạy toàn bộ Unit Tests (Tất cả các Task):
```bash
npm test
```
> Kết quả: Tự động chạy toàn bộ các bài test cho cả **Task 1-5 (Deadline)** và **Task 13 (Rules Engine Phân loại tin tức)**.

### 3. Khởi chạy Server:
```bash
npm start
```
- **Web UI quản lý hạn chót (Task 1):** `http://localhost:3000/`
- **API Deadlines (Task 3 & 4):** `http://localhost:3000/api/v1/deadlines`
- **API FCM Device Tokens (Task 6):** `http://localhost:3000/api/v1/device-tokens`
- **API Thông báo & Rules Engine (Task 11 & 13):** `http://localhost:3000/api/v1/notifications`

---

## 📱 1. Module Quản Lý Hạn Chót Bài Tập (Deadline Management - Task 1, 2, 3, 4, 5)

- **Flutter Mobile App:** Mã nguồn hoàn chỉnh đặt tại thư mục [`mobile_app/`](mobile_app/) (kèm tài liệu Wireframe [`mobile_app/WIREFRAME.md`](mobile_app/WIREFRAME.md)).
- **REST API Endpoints:**
  | Method | Endpoint | Chức năng |
  |---|---|---|
  | `GET` | `/` hoặc `/deadlines` | Giao diện Web tương tác trực quan (Responsive Mobile/Web) |
  | `GET` | `/api/v1/courses` | Lấy danh sách môn học (`IT401`, `IT302`, `IT501`...) |
  | `GET` | `/api/v1/deadlines` | Lấy danh sách deadline (Hỗ trợ lọc: `?subject=IT401&status=DUE_SOON&search=tên`) |
  | `POST` | `/api/v1/deadlines` | Tạo deadline mới (`title`, `subject`, `due_date`, `note`) |
  | `GET` | `/api/v1/deadlines/:id` | Xem chi tiết 1 hạn chót |
  | `PUT` | `/api/v1/deadlines/:id` | Cập nhật thông tin hạn chót |
  | `PATCH`| `/api/v1/deadlines/:id/complete` | Checkbox tick hoàn thành / bỏ hoàn thành bài tập |
  | `DELETE`| `/api/v1/deadlines/:id` | Xóa hạn chót |

---

## 🔔 2. Module Push Notification & FCM Token (Task 6)

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/v1/device-tokens` | Lưu Device Token (FCM/APNs) của sinh viên vào Database |
| `GET` | `/api/v1/device-tokens` | Lấy danh sách Device Token đang hoạt động |
| `POST` | `/api/v1/device-tokens/test-push` | Gửi thử nghiệm Push Notification giả lập |

---

## 📢 3. Module Thu Thập Thông Báo & Rules Engine Phân Loại (Task 11 & 13)

- **Bảng CSDL:** [`src/db/schema.sql`](src/db/schema.sql)
- **Rules Engine:** [`src/services/classifier.service.js`](src/services/classifier.service.js)
- **REST API Endpoints:**
  | Method | Endpoint | Chức năng |
  |---|---|---|
  | `GET` | `/api/v1/notifications/sources` | Lấy danh sách các kênh nguồn thông báo đang hoạt động. |
  | `GET` | `/api/v1/notifications/rules` | Tra cứu danh mục quy tắc, trọng số và danh sách từ khóa của Rules Engine. |
  | `POST` | `/api/v1/notifications/classify` | Thử nghiệm & xem trước phân loại (gắn tag, chung/lớp/riêng, điểm ưu tiên). |
  | `POST` | `/api/v1/notifications/collect` | Thu thập 1 thông báo mới (tự động chạy qua Rules Engine nếu chưa phân loại). |
  | `POST` | `/api/v1/notifications/collect-batch`| Thu thập lô thông báo từ Crawler/Webhook. |
  | `GET` | `/api/v1/notifications` | Lấy bảng tin thông báo tập trung. |
  | `GET` | `/api/v1/notifications/:id` | Xem chi tiết thông báo. |
