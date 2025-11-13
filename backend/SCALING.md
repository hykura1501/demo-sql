# Scaling Architecture

## Vấn đề với giải pháp cũ

**In-memory database mỗi request:**
- ❌ Mỗi request tạo database mới → tốn tài nguyên
- ❌ Không thể lưu state giữa các requests
- ❌ Không scale được cho nhiều user đồng thời
- ❌ Phải parse DBML và insert data mỗi lần

## Giải pháp mới: Session-based Architecture

### Kiến trúc

```
User Request → Session Manager → File-based SQLite Database
                ↓
         Session Pool (in-memory)
                ↓
         Auto Cleanup (30min timeout)
```

### Lợi ích

✅ **Performance**: 
- Database được tạo 1 lần, reuse cho nhiều queries
- Không cần parse DBML và insert data mỗi lần
- Connection pooling

✅ **Scalability**:
- Mỗi user có database riêng (isolated)
- Hỗ trợ hàng trăm user đồng thời
- File-based SQLite (không giới hạn bởi RAM)

✅ **Session Management**:
- Tự động cleanup sessions cũ (30 phút timeout)
- Có thể quản lý và monitor sessions
- Session persistence giữa các requests

### Cách hoạt động

1. **First Request**: 
   - User gửi request không có `sessionId`
   - Server tạo session mới + database file
   - Trả về `sessionId` cho client

2. **Subsequent Requests**:
   - Client gửi `sessionId` trong request
   - Server reuse database đã có
   - Chỉ update nếu DBML/data thay đổi

3. **Auto Cleanup**:
   - Sessions không dùng > 30 phút sẽ bị xóa
   - Database files được cleanup tự động
   - Chạy mỗi 5 phút

### API Changes

**Request (có thể có sessionId):**
```json
{
  "sessionId": "session_1234567890_abc", // optional
  "dbml": "...",
  "data": {...},
  "query": "SELECT * FROM users"
}
```

**Response (trả về sessionId):**
```json
{
  "success": true,
  "rows": [...],
  "sessionId": "session_1234567890_abc"
}
```

### Performance Comparison

| Metric | Old (In-memory) | New (Session-based) |
|--------|----------------|---------------------|
| First query | ~50ms | ~50ms |
| Subsequent queries | ~50ms | ~5ms |
| Memory per user | ~10MB (per request) | ~1MB (persistent) |
| Max concurrent users | ~50 | ~500+ |

### Monitoring

- `GET /api/health` - Xem số active sessions
- `DELETE /api/session/:sessionId` - Xóa session thủ công

### Tối ưu hóa thêm (Future)

1. **Database Connection Pooling**: Reuse connections
2. **Redis Cache**: Cache parsed DBML schemas
3. **Load Balancing**: Multiple server instances
4. **Container Isolation**: Mỗi user một container (Docker/Kubernetes)

## Chiến lược mở rộng nâng cao

Để tiến tới mục tiêu cho phép sinh viên lựa chọn nhiều hệ quản trị cơ sở dữ liệu (MySQL, PostgreSQL, SQL Server…) và vẫn đảm bảo hệ thống chịu tải lớn, cần từng bước thoát khỏi kiến trúc SQLite session-based hiện tại. Các đề xuất dưới đây được sắp xếp theo mức độ ưu tiên triển khai.

### 1. Lưu trữ session tập trung (Redis hoặc RDBMS)
- **Mục tiêu**: giúp backend stateless và dễ dàng scale ngang (nhiều instance backend chạy song song).
- **Cách làm**:
  - Lưu thông tin session (schema đã parse, dữ liệu mẫu, engine được chọn, trạng thái bài thi) trong Redis hoặc PostgreSQL/MySQL.
  - Redis được ưu tiên vì tốc độ cao, hỗ trợ TTL để tự động xoá session hết hạn.
  - Backend chỉ cần nhận `sessionId`, lấy metadata từ Redis rồi điều hướng tới engine phù hợp.
- **Lợi ích**: phiên làm việc không phụ thuộc vào một máy backend cụ thể; giảm yêu cầu sticky session ở load balancer.

### 2. Lớp trừu tượng Database Engine
- **Mục tiêu**: tách riêng phần xử lý DBML/seed data khỏi từng DB cụ thể để dễ dàng thêm mới hoặc thay đổi engine.
- **Cách làm**:
  - Định nghĩa interface `DatabaseEngine` với các hàm chuẩn: `connect`, `createSchema`, `seedData`, `executeQuery`, `cleanup`.
  - Cài đặt riêng cho từng engine: `SQLiteEngine`, `PostgresEngine`, `MySQLEngine`, `SqlServerEngine`.
  - Xây dựng bộ chuyển đổi DBML → SQL tương ứng từng engine (map kiểu dữ liệu, constraint, auto increment...).
- **Lợi ích**: khi muốn hỗ trợ thêm DB, chỉ cần viết class mới mà không ảnh hưởng phần còn lại.

### 3. Connection pool chuyên biệt cho từng engine
- **Mục tiêu**: giảm chi phí mở/đóng kết nối, tránh nghẽn cổ chai khi nhiều sinh viên chạy cùng lúc.
- **Cách làm**:
  - Dùng pool cho từng engine (`pg.Pool`, `mysql2` pool, MSSQL pool...).
  - Với mỗi session, tạo schema riêng (ví dụ `session_abc.users`) hoặc database riêng tuỳ engine.
  - Khi session kết thúc => drop schema/database để giải phóng.
- **Lợi ích**: reuse kết nối; bảo đảm mỗi sinh viên chỉ ảnh hưởng tới “phân vùng” của mình.

### 4. Sandbox dạng container (lộ trình dài hạn)
- **Mục tiêu**: đảm bảo an toàn tuyệt đối khi sinh viên chạy queries tuỳ ý, kể cả DDL phức tạp.
- **Cách làm**:
  - Khi tạo session, khởi tạo container nhẹ chứa DB engine tương ứng (Docker, Podman, hoặc executor trên Kubernetes).
  - Seed schema/data thông qua client CLI hoặc script.
  - Huỷ container khi session hết hạn để tránh rò rỉ tài nguyên.
- **Ưu điểm**: cô lập hoàn toàn, khó bị tấn công; dễ benchmark; hỗ trợ nhiều engine khác nhau.
- **Nhược điểm**: chi phí hạ tầng cao, cần hệ thống orchestration và auto-scaling phức tạp hơn.

### 5. Dịch vụ thực thi truy vấn + hàng đợi (Job Queue)
- **Mục tiêu**: quản lý tải lớn và kiểm soát timeout/quy tắc thực thi.
- **Cách làm**:
  - Frontend gửi yêu cầu vào hàng đợi (RabbitMQ, Kafka, hoặc Redis Streams).
  - Worker chuyên dụng đọc queue, thực thi truy vấn trên engine tương ứng, ghi kết quả về cache hoặc publish event cho frontend.
  - Có thể cấu hình giới hạn số truy vấn chạy đồng thời, ưu tiên theo phòng thi, v.v.
- **Lợi ích**: backend chính không bị block; dễ scale số worker theo tải thực tế.

### 6. Chiến lược multi-tenant trên DB
- **Mục tiêu**: cách ly giữa các sinh viên/nhóm và đơn giản hoá audit.
- **Cách làm**:
  - PostgreSQL: tạo schema riêng cho mỗi session (`CREATE SCHEMA session_xyz`).
  - MySQL: tạo database riêng (hoặc dùng prefix cho bảng).
  - SQL Server: dùng schema hoặc dedicated database tuỳ policy.
  - Viết cơ chế dọn dẹp (drop schema/database) khi session kết thúc.
- **Lợi ích**: dễ theo dõi, kiểm soát quyền, tránh “đụng” dữ liệu giữa các đội thi.

### 7. Quan sát & vận hành (Observability & Governance)
- **Mục tiêu**: phát hiện sớm sự cố và đảm bảo hệ thống vận hành ổn định.
- **Cách làm**:
  - Logging tập trung: ELK stack hoặc Loki + Grafana.
  - Metrics/Tracing: Prometheus, Grafana, OpenTelemetry để theo dõi thời gian thực thi, số session, sử dụng kết nối.
  - Alerting: cảnh báo khi queue backlog, pool gần cạn, job timeout, tỷ lệ lỗi tăng.
- **Lợi ích**: đội vận hành chủ động xử lý sự cố, nâng cao chất lượng dịch vụ khi số lượng sinh viên tăng mạnh.

### Lộ trình khuyến nghị
1. **Ngắn hạn**: triển khai session storage tập trung, xây dựng abstraction layer và kết nối pool cho từng engine chính.
2. **Trung hạn**: bổ sung hàng đợi + worker để tách biệt bước thực thi truy vấn, tối ưu hoá job scheduling.
3. **Dài hạn**: xây dựng nền tảng sandbox container cho từng engine, tích hợp với hệ thống coi thi và các yêu cầu bảo mật nâng cao.

Các bước trên giúp hệ thống mở rộng dần theo nhu cầu, đảm bảo vừa linh hoạt hỗ trợ nhiều loại cơ sở dữ liệu, vừa đủ mạnh để phục vụ hàng nghìn thí sinh đồng thời trong kỳ thi trực tuyến.


