# LUMORA Frontend Realtime Dashboard

## Chạy project

```bash
npm install
npm run dev
```

Backend mặc định: `http://localhost:8080`.
Có thể đổi trong `.env`:

```env
VITE_API_URL=http://localhost:8080
```

## Đã bổ sung

### Admin
- Dashboard biểu đồ realtime
- Quản lý nhân viên: thêm, sửa, xóa
- Quản lý bàn: thêm, sửa, xóa, tạo QR, hiển thị ảnh QR nếu backend trả về URL/base64
- Quản lý danh mục: thêm, sửa, xóa
- Quản lý món ăn: thêm, sửa, xóa, nhập URL ảnh hoặc upload ảnh local dạng base64
- Quản lý khuyến mãi: thêm, sửa, xóa
- Báo cáo dùng dashboard chart

### Phục vụ
- Danh sách bàn và đổi trạng thái bàn
- Danh sách đơn realtime
- Chi tiết đơn
- Xác nhận đơn, đã phục vụ, chuyển thu ngân

### Bếp
- Màn hình bếp realtime
- Nhóm món theo đơn/bàn
- Chi tiết đơn bếp
- Cập nhật trạng thái món: CHO_BEP -> DANG_NAU -> HOAN_THANH

### Thu ngân
- Danh sách đơn chờ thanh toán
- Trang thanh toán chi tiết
- Hóa đơn/in bill
- Không còn hardcode `maNhanVien: 1`, lấy từ user đăng nhập nếu backend trả về

### Khách hàng
- Lọc món theo danh mục
- Tìm kiếm món
- Chi tiết món
- Giỏ hàng
- Chọn/nhập khuyến mãi
- Theo dõi trạng thái đơn realtime sau khi đặt
- Nút gọi phục vụ: gọi API `/api/customer/tables/{id}/call-waiter` nếu backend có hỗ trợ; nếu backend chưa có thì UI vẫn không bị vỡ.

## Lưu ý
- Không nén kèm `node_modules`.
- Đã fix `window.global` cho `sockjs-client` trong Vite.
- Build đã chạy thành công bằng `npm run build`.
