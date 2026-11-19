# 📢 Hệ Thống Tổng Hợp & Cảnh Báo Thông Báo Đa Nguồn Sinh Viên DUT

> **Dự án Nhóm môn Công nghệ Phần mềm – Đại học Bách Khoa, Đại học Đà Nẵng (DUT)**  
> **Tài liệu đặc tả nghiệp vụ & kỹ thuật chi tiết:** [AGENT.md](AGENT.md)  
> **Kiến trúc hệ thống:** Node.js Backend (`node:http`) + PostgreSQL + Flutter Mobile (`Riverpod` & `GoRouter`) + Firebase (FCM & Auth) + Google Calendar OAuth 2.0  
> **Tiến độ triển khai:** Đã hoàn thành 100% toàn bộ 9 Yêu cầu Chức năng (**FR-01** đến **FR-09**) và vượt qua 23/23 Automated Tests.

---

## 🚀 Danh Sách Yêu Cầu Chức Năng (FR-01 -> FR-09)

| Mã CN | Tên Chức Năng | Hiện Thực & Kiểm Thử |
|---|---|---|
| **FR-01** | **Đồng bộ Học phần từ `sv.dut.udn.vn`** | Đăng nhập trích xuất danh sách lớp học phần sinh viên đang học và khởi tạo không gian thông báo riêng (`src/services/dut-crawler.service.js`, `course.service.js`). |
| **FR-02** | **Thu thập & Chống trùng lặp đa nguồn** | Thu thập từ 7 chuyên mục cổng thông tin trường và 2 Fanpage Facebook (`ctsvdhbkdhdn`, `tuvansinhvien.dut`). Chống trùng lặp bằng mã băm **SHA-256** `content_hash` (`src/services/notification.service.js`). |
| **FR-03** | **Phân loại thông minh kết hợp (Rules + AI API) & 5 Loại thông báo chuẩn** | **Rules Engine** & **AI API** tự động phân loại thông báo theo **5 loại chính**: (1) **Thông báo học tập** (`ACADEMIC`: đổi lịch học, nghỉ học, học bù, đổi phòng học, thi...), (2) **Thông báo điểm số** (`GRADE`: phúc khảo điểm, cảnh báo kết quả học tập...), (3) **Thông báo hành chính** (`ADMINISTRATIVE`: đăng ký học phần, học phí...), (4) **Hoạt động sự kiện** (`EVENT`: workshop, cuộc thi, tình nguyện...), (5) **Thông báo nghề nghiệp** (`CAREER`: tuyển dụng, thực tập, hạn ứng tuyển...). Công thức tính điểm ưu tiên đa trọng số $S_{\text{total}} = W_{\text{base}} + W_{\text{scope}} + W_{\text{keyword}} + W_{\text{urgency}}$ (`src/services/classifier.service.js`). |
| **FR-04** | **Mục thông báo riêng từng học phần** | Gom thông báo từ `DUT_COURSE_CLASS` vào đúng môn sinh viên đang học, hiển thị số tin chưa đọc (`unread_count`) và deadline sắp tới (`src/services/course.service.js`). |
| **FR-05** | **Bảng tin thông báo tập trung & Cá nhân hóa** | Bảng tin hợp nhất lọc theo 7 chuyên mục web trường, 2 Fanpage FB, tags, độ ưu tiên, tìm kiếm từ khóa (`src/services/notification.service.js`, `HomeFeedScreen`). |
| **FR-06** | **Quản lý danh sách hạn chót (Deadlines CRUD)** | Quản lý hạn chót đóng học phí, nộp chứng chỉ, bài tập môn học kèm đồng hồ đếm ngược và trạng thái động (`PENDING`, `DUE_SOON`, `OVERDUE`, `COMPLETED`) (`src/services/deadline.service.js`). |
| **FR-07** | **Cảnh báo đẩy & Nhắc việc leo thang đa tầng** | Đẩy FCM lên màn hình khóa và kích hoạt cảnh báo leo thang trước hạn chót: **168h (7 ngày)**, **72h (3 ngày)**, **24h (1 ngày)** và **2h** (`deadline.service.js`, `pushNotificationService.js`). |
| **FR-08** | **Cảnh báo khẩn cấp & Xác nhận Đã đọc (Read Receipt)** | Nhận diện tức thì nghỉ học đột xuất, đổi phòng, hoãn thi $\rightarrow$ `is_emergency = true`, hiển thị **Banner ghim đầu trang** & **Popup cảnh báo toàn màn hình**, hỗ trợ gửi xác nhận **"Đã hiểu / Đã nhận tin"** qua API `/ack` (`notification.service.js`, `emergency_alert_modal.dart`). |
| **FR-09** | **Đồng bộ hóa tự động lên Google Calendar** | Xác thực OAuth 2.0 lưu `google_refresh_token`, tự động đẩy sự kiện hạn chót và lịch học bù lên **Google Calendar**, hỗ trợ xuất tệp chuẩn iCalendar `.ics` (`src/services/google-calendar.service.js`). |

---

## 📂 Cấu Trúc Mã Nguồn

```text
LamNhomCongNghe/
├── AGENT.md                                # Tài liệu đặc tả chuẩn BRD/SRS & TSD
├── package.json
├── src/
│   ├── server.js                           # HTTP Server thuần (node:http)
│   ├── config/
│   │   ├── db.js                           # Kết nối PostgreSQL (pg.Pool) & In-Memory Store
│   │   ├── ai.js                           # Google Gemini API client & Fallback Heuristic Engine
│   │   └── firebase.js                     # Cấu hình firebase-admin SDK (FCM)
│   ├── api/
│   │   ├── notification.routes.js          # RESTful APIs (Courses, Ingest, Deadlines, Calendar)
│   │   └── device.routes.js                # API đăng ký thiết bị nhận push FCM
│   ├── controllers/
│   │   ├── notification.controller.js      # Điều phối nghiệp vụ thông báo, deadlines, lịch
│   │   └── device.controller.js            # Điều phối đăng ký thiết bị FCM
│   ├── services/
│   │   ├── dut-crawler.service.js          # FR-01, FR-02: Scraper sv.dut.udn.vn (7 chuyên mục)
│   │   ├── fb-crawler.service.js           # FR-02: Bộ thu thập bài đăng 2 Fanpage Facebook
│   │   ├── classifier.service.js           # FR-03: Smart Router (Rules Engine + AI API)
│   │   ├── course.service.js               # FR-01, FR-04: Quản lý học phần & badge chưa đọc
│   │   ├── deadline.service.js             # FR-06, FR-07: CRUD Deadlines & Worker nhắc hạn 4 tầng
│   │   ├── google-calendar.service.js      # FR-09: Tích hợp Google Calendar OAuth2 & xuất .ics
│   │   ├── notification.service.js         # FR-02, FR-08: SHA-256 hash, FCM, Emergency Ack
│   │   └── pushNotificationService.js      # Dịch vụ gửi push đa nền tảng
│   └── db/
│       ├── schema.sql                      # DDL Schema chuẩn PostgreSQL (ENUMs, Tables, GIN Indexes)
│       └── postgres.js                     # Repository truy vấn CSDL
├── tests/
│   ├── agent-fr-all.test.js                # Test suite bao quát 100% 9 yêu cầu chức năng FR-01 -> FR-09
│   ├── classifier.test.js                  # Test suite Rules Engine Task 13
│   └── push-notification.test.js           # Test suite đăng ký thiết bị & FCM Task 6
└── mobile/                                 # Ứng dụng Flutter & Dart
    ├── pubspec.yaml
    └── lib/
        ├── app/
        │   ├── router.dart                 # GoRouter với Bottom Navigation Bar 3 tab
        │   └── app.dart
        └── features/
            ├── notifications/
            │   ├── domain/notification_item.dart
            │   └── presentation/
            │       ├── home_feed_screen.dart       # Bảng tin 7+2 bộ lọc & Banner khẩn cấp
            │       ├── emergency_alert_modal.dart  # Modal cảnh báo khẩn cấp & xác nhận Read Receipt
            │       └── notification_detail_page.dart
            ├── courses/
            │   ├── domain/course_item.dart
            │   └── presentation/enrolled_courses_screen.dart # Danh sách học phần & badge
            └── deadlines/
                ├── domain/deadline_item.dart
                └── presentation/deadlines_screen.dart        # Deadlines đếm ngược & Sync Calendar
```

---

## 🔌 Danh Sách RESTful API Endpoints

| Method | Endpoint | Mô tả chức năng |
|---|---|---|
| `POST` | `/api/v1/dut/sync-courses` | Đồng bộ danh sách học phần sinh viên đang học từ `sv.dut.udn.vn`. |
| `GET` | `/api/v1/courses/enrolled` | Lấy danh sách học phần kèm số tin chưa đọc (`unread_count`) & số deadline sắp tới. |
| `GET` | `/api/v1/courses/:code/notifications` | Lấy luồng thông báo riêng biệt của một lớp học phần. |
| `GET` | `/api/v1/notifications` | Bảng tin thông báo tổng hợp (hỗ trợ lọc theo 5 loại thông báo: `category`, 7 mục web trường, 2 fanpage FB, tag, search). |
| `GET` | `/api/v1/notifications/categories` | Lấy danh mục 5 loại thông báo chính (`ACADEMIC`, `GRADE`, `ADMINISTRATIVE`, `EVENT`, `CAREER`). |
| `POST` | `/api/v1/notifications/ingest` | Thu thập tin mới $\rightarrow$ Băm SHA-256 $\rightarrow$ Smart Classifier $\rightarrow$ Lưu DB $\rightarrow$ FCM & Deadline. |
| `POST` | `/api/v1/notifications/:id/ack` | Xác nhận **Đã đọc / Đã nhận tin (Read Receipt)** cho thông báo khẩn cấp. |
| `GET` | `/api/v1/deadlines` | Lấy danh sách hạn chót của sinh viên (hỗ trợ lọc `status`, `course_code`). |
| `POST` | `/api/v1/deadlines` | Tạo mới một mốc hạn chót học tập. |
| `PUT` | `/api/v1/deadlines/:id` | Cập nhật thông tin hoặc đánh dấu hoàn thành (`COMPLETED`). |
| `DELETE`| `/api/v1/deadlines/:id` | Xóa một mốc hạn chót. |
| `POST` | `/api/v1/calendar/google/connect` | Xác thực OAuth 2.0 lưu `google_refresh_token`. |
| `POST` | `/api/v1/calendar/google/sync` | Đồng bộ hóa hạn chót và lịch học bù lên Google Calendar. |
| `GET` | `/api/v1/calendar/export.ics` | Tải về tệp định dạng chuẩn iCalendar (`.ics`). |

---

## 🧪 Chạy Kiểm Thử Tự Động Toàn Diện

```bash
npm test
```

Kết quả:
```text
✔ FR-01: Đồng bộ Học phần từ sv.dut.udn.vn
✔ FR-02: Thu thập & Chống trùng lặp thông báo đa nguồn (SHA-256 hash)
✔ FR-03: Phân loại thông minh kết hợp (Rules Engine + AI API)
✔ FR-04: Mục thông báo riêng cho từng Học phần đang học
✔ FR-05: Bảng tin thông báo tập trung & Bộ lọc đa chiều
✔ FR-06: Quản lý danh sách hạn chót (Deadline Management CRUD)
✔ FR-07: Worker cảnh báo nhắc việc leo thang đa tầng
✔ FR-08: Cảnh báo khẩn cấp & Xác nhận Đã đọc (Read Receipt - ack)
✔ FR-09: Đồng bộ Google Calendar và Xuất tệp .ics
✔ Task 13: Rules Engine và chấm điểm ưu tiên đa trọng số
✔ Task 6: Push notification và đăng ký thiết bị an toàn
ℹ tests 23 | pass 23 | fail 0
```
