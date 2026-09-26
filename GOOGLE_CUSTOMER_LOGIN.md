# Đăng nhập Google cho khách hàng Lumora

Bản frontend này dùng cùng bản `backend_google_customer.zip` đã bổ sung khách hàng Google.

## Thay đổi
- Trang đăng nhập chung tiếp tục gọi `POST /api/auth/google` như trước.
- Khi backend trả vai trò `CUSTOMER`, khách quay về trang `next` trong khu vực menu hoặc mặc định `/menu/account`.
- Lưu tên khách từ `hoTen` hoặc `fullName`; chấp nhận SĐT chưa có và giữ mã khách, điểm tích lũy, token.
- Trang tài khoản hiển thị "Chưa bổ sung số điện thoại" và nút "Bổ sung số điện thoại". Dùng modal và API cập nhật hồ sơ hiện có, kiểm tra SĐT trước khi lưu.
- Trang đặt hàng đã có ô SĐT bắt buộc, tự điền tên khách và SĐT đã lưu nên không cần sửa.
- Luồng Google của ADMIN, WAITER, KITCHEN, CASHIER và đăng nhập mật khẩu giữ nguyên.

## Sử dụng
1. Triển khai backend hỗ trợ Google khách hàng trước.
2. Giữ `VITE_GOOGLE_CLIENT_ID` trùng `GOOGLE_CLIENT_ID` của backend, `VITE_API_URL` trỏ về backend đang dùng.
3. Chạy `npm run build` và triển khai frontend mới; không dùng bản `dist` đã tạo từ mã cũ.
4. Kiểm tra Google bằng tài khoản khách hàng thực tế trên tên miền đã cấu hình.

## Kiểm tra bản cập nhật
- Vite production build thành công.
- 8 kịch bản trình duyệt đạt: Google khách quay lại checkout và lưu tên/SĐT trống; vào tài khoản mặc định và bổ sung SĐT (kiểm tra SĐT trống, lưu, tải lại); 4 vai trò nhân viên; lỗi đăng nhập Google; đăng nhập mật khẩu khách quay về checkout.
- Các kịch bản dùng API và phản hồi Google giả lập. Chưa xác minh đăng nhập Google thật trên website triển khai.
