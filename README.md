# 🎓 DUT Smart Campus System: Quản Lý Hạn Chót Bài Tập & Thông Báo

> **Dự án nhóm môn Công nghệ Phần mềm**  
> **Kiến trúc hệ thống:** Node.js Backend + PostgreSQL + Web/Mobile Client + Firebase (FCM / Auth)  

---

## 📌 Bảng phân công & Tiến độ các Task

| No | Task | Phụ trách | Tiến độ | Mô tả chi tiết |
|:---:|:---|:---|:---:|:---|
| **1** | Thiết kế UI danh sách hạn chót & bộ lọc theo môn học | Nguyễn Hữu Duy Bảo | **100%** | Wireframe & Web UI responsive, lọc môn học & trạng thái |
| **2** | Thiết kế Database Schema lưu trữ deadline & môn học | Nguyễn Hữu Duy Bảo | **100%** | Bảng `deadlines`, `courses` & ENUM `deadline_status_type` |
| **3** | Xây dựng API CRUD quản lý hạn chót (thêm, sửa, xóa) | Nguyễn Hữu Duy Bảo | **100%** | Các endpoint REST API GET, POST, PUT, DELETE |
| **4** | Phân loại trạng thái deadline & tick hoàn thành bài tập | Nguyễn Hữu Duy Bảo | **100%** | Tự động tính Overdue, Due Soon, Upcoming; checkbox toggle |
| **5** | Kiểm thử chức năng (Unit Test) & tối ưu responsive | Nguyễn Hữu Duy Bảo | **100%** | Bộ 17 unit tests tự động (`npm test`), kiểm tra responsive |
| **6** | Tích hợp Push Notification (FCM/APNs) & lưu Token DB | Hồ Đăng Hùng | **100%** | Bảng `user_device_tokens`, lưu token thiết bị & mock FCM push |
| **11**| Thiết kế Schema CSDL & API thu thập thông báo đa nguồn | Nguyễn Hữu Tuấn | **100%** | Bảng `notifications`, đa nguồn PDT, Khoa, Lớp, Email |

---

## 🚀 Hướng Dẫn Khởi Chạy & Kiểm Thử

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Chạy toàn bộ Unit Tests (Task 5):
```bash
npm test
```
> Kết quả: Chạy 17 bài test kiểm thử tự động (Auto-status, CRUD API, FCM Tokens, Responsive HTML).

### 3. Khởi chạy Server:
```bash
npm start
```
- **Giao diện Web UI (Task 1):** `http://localhost:3000/` (hoặc `http://localhost:3000/deadlines`)
- **API Deadlines (Task 3 & 4):** `http://localhost:3000/api/v1/deadlines`
- **API FCM Device Tokens (Task 6):** `http://localhost:3000/api/v1/device-tokens`
- **API Thông báo đa nguồn (Task 11):** `http://localhost:3000/api/v1/notifications`

---

## 🔌 Danh Sách Endpoint REST API

### Module Quản Lý Hạn Chót (Deadline Management - Task 3 & 4)
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

### Module Push Notification & FCM Token (Task 6)
| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/v1/device-tokens` | Lưu Device Token (FCM/APNs) của sinh viên vào Database |
| `GET` | `/api/v1/device-tokens` | Lấy danh sách Device Token đang hoạt động |
| `POST` | `/api/v1/device-tokens/test-push` | Gửi thử nghiệm Push Notification giả lập |

### Module Thu Thập Thông Báo Đa Nguồn (Task 11)
| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/v1/notifications/sources` | Danh sách kênh nguồn (Phòng Đào tạo, Khoa, LMS, Email...) |
| `POST` | `/api/v1/notifications/collect` | Thu thập 1 thông báo |
| `POST` | `/api/v1/notifications/collect-batch`| Thu thập hàng loạt thông báo |
| `GET` | `/api/v1/notifications` | Lấy bảng tin thông báo tập trung |
| `GET` | `/api/v1/notifications/:id` | Xem chi tiết thông báo |
