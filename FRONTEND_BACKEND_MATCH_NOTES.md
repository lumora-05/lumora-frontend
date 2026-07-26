# Kiểm tra frontend khớp backend

Đã đối chiếu frontend với các controller trong backend:

- `/api/auth`
- `/api/dashboard`
- `/api/employees`
- `/api/tables`
- `/api/categories`
- `/api/menu`
- `/api/promotions`
- `/api/orders`
- `/api/payments`
- `/api/uploads/foods`
- `/api/customer/tables/{tableId}`
- `/api/customer/orders`
- `/api/customer/orders/{orderId}`

## Đã bổ sung/sửa

1. Admin có đủ menu:
   - Dashboard
   - Nhân viên
   - Bàn ăn
   - Danh mục
   - Món ăn
   - Khuyến mãi
   - Đơn hàng
   - Báo cáo
   - QR Code
   - Tài khoản

2. Thêm trang Admin quản lý đơn hàng: `/admin/orders`.
3. Thêm trang QR Code: `/admin/qr-codes`.
4. Thêm trang tài khoản: `/admin/account`.
5. Sửa upload ảnh món ăn dùng đúng endpoint backend: `POST /api/uploads/foods`.
6. Sửa khuyến mãi dùng field `loaiGiam` đúng DTO backend.
7. Sửa khách hàng lấy menu theo bàn qua `/api/customer/tables/{tableId}`.
8. Sửa tracking đơn khách qua `/api/customer/orders/{orderId}`.
9. Sửa thanh toán gửi đúng payload backend: `maDonHang`, `maNhanVien`, `phuongThucThanhToan`.
10. Bỏ gọi endpoint `call-waiter` vì backend hiện tại chưa có API này.

## Build

Đã chạy `npm run build` thành công.
