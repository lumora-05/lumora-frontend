import { useEffect, useState } from 'react';
import {
  Award,
  History,
  Lock,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Unlock,
  UserRound,
  X,
} from 'lucide-react';
import { loyaltyApi } from '../../api/loyaltyApi';
import { useDebounce } from '../../hooks/useDebounce';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { dateTimeText } from '../../utils/cashier';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';

const emptyForm = { hoTen: '', soDienThoai: '' };
const emptyAdjustment = { soDiem: '', lyDo: '' };

const TRANSACTION_LABELS = {
  EARN: 'Cộng từ hóa đơn',
  REDEEM: 'Đổi điểm',
  ADJUST: 'Điều chỉnh',
};

const ORDER_STATUS_LABELS = {
  CHO_THANH_TOAN: 'Chờ thanh toán',
  CHO_XAC_NHAN: 'Chờ xác nhận',
  CHO_DEN_GIO: 'Chờ đến giờ',
  DANG_CHUAN_BI: 'Đang chuẩn bị',
  CHO_TAI_XE_NHAN: 'Chờ tài xế nhận',
  DANG_GIAO: 'Đang giao',
  CHO_DOI_SOAT: 'Chờ đối soát COD',
  HOAN_THANH: 'Hoàn thành',
  DA_HUY: 'Đã hủy',
  HUY: 'Đã hủy',
};

const ORDER_TYPE_LABELS = {
  GIAO_HANG: 'Giao tận nơi',
  DELIVERY: 'Giao tận nơi',
  MANG_VE: 'Đến lấy',
  PICKUP: 'Đến lấy',
  TAI_BAN: 'Tại bàn',
};

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

export default function CustomerLoyaltyManage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [orderCustomer, setOrderCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  const [adjustCustomer, setAdjustCustomer] = useState(null);
  const [adjustment, setAdjustment] = useState(emptyAdjustment);
  const [adjustLoading, setAdjustLoading] = useState(false);

  const debouncedKeyword = useDebounce(keyword, 350);

  async function loadCustomers() {
    setLoading(true);
    try {
      const response = await loyaltyApi.customers({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
      });
      const result = normalizePage(response, size);
      if (result.totalPages > 0 && page >= result.totalPages) {
        setPage(result.totalPages - 1);
        return;
      }
      setRows(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setNumberOfElements(result.numberOfElements);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách khách hàng.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [page, size, debouncedKeyword]);

  useEffect(() => {
    loyaltyApi.policy().then((response) => {
      setPolicy(response?.data || response);
    }).catch(() => setPolicy(null));
  }, []);

  function openCreate() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(customer) {
    setEditingCustomer(customer);
    setForm({
      hoTen: customer?.hoTen || '',
      soDienThoai: customer?.soDienThoai || '',
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (formLoading) return;
    setFormOpen(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  }

  async function submitCustomer(event) {
    event.preventDefault();
    if (!form.hoTen.trim()) {
      toast.error('Vui lòng nhập họ tên khách hàng.');
      return;
    }
    if (!/^0\d{9}$/.test(form.soDienThoai)) {
      toast.error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        hoTen: form.hoTen.trim(),
        soDienThoai: form.soDienThoai,
      };
      const response = editingCustomer
        ? await loyaltyApi.updateCustomer(editingCustomer.maKhachHang, payload)
        : await loyaltyApi.createCustomer(payload);
      const wasEditing = Boolean(editingCustomer);
      toast.success(messageOf(response, wasEditing ? 'Cập nhật khách hàng thành công.' : 'Thêm khách hàng thành công.'));
      setFormOpen(false);
      setEditingCustomer(null);
      setForm(emptyForm);
      if (!wasEditing && page !== 0) setPage(0);
      else loadCustomers();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể lưu khách hàng.'));
    } finally {
      setFormLoading(false);
    }
  }

  async function openHistory(customer) {
    setHistoryCustomer(customer);
    setHistoryLoading(true);
    setTransactions([]);
    try {
      const response = await loyaltyApi.transactions(customer.maKhachHang, { page: 0, size: 50 });
      const result = normalizePage(response, 50);
      setTransactions(result.content);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải lịch sử điểm.'));
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryCustomer(null);
    setTransactions([]);
  }

  async function openOrders(customer) {
    setOrderCustomer(customer);
    setOrdersLoading(true);
    setOrders([]);
    try {
      const response = await loyaltyApi.orders(customer.maKhachHang);
      setOrders(response?.data || response || []);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải lịch sử đơn hàng.'));
    } finally {
      setOrdersLoading(false);
    }
  }

  function closeOrders() {
    setOrderCustomer(null);
    setOrders([]);
  }

  async function toggleAccountStatus(customer) {
    if (!customer?.coTaiKhoan || statusLoadingId) return;
    const locking = customer.trangThai === 'HOAT_DONG';
    const confirmed = window.confirm(
      locking
        ? `Khóa tài khoản của ${customer.hoTen || customer.soDienThoai}? Khách sẽ không thể đăng nhập cho đến khi được mở khóa.`
        : `Mở khóa tài khoản của ${customer.hoTen || customer.soDienThoai}?`
    );
    if (!confirmed) return;

    setStatusLoadingId(customer.maKhachHang);
    try {
      const response = await loyaltyApi.updateStatus(customer.maKhachHang, locking ? 'KHOA' : 'HOAT_DONG');
      toast.success(messageOf(response, locking ? 'Đã khóa tài khoản khách hàng.' : 'Đã mở khóa tài khoản khách hàng.'));
      loadCustomers();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật trạng thái tài khoản.'));
    } finally {
      setStatusLoadingId(null);
    }
  }

  function openAdjust(customer) {
    setAdjustCustomer(customer);
    setAdjustment(emptyAdjustment);
  }

  function closeAdjust() {
    if (adjustLoading) return;
    setAdjustCustomer(null);
    setAdjustment(emptyAdjustment);
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    const points = Number(adjustment.soDiem);
    if (!Number.isInteger(points) || points === 0) {
      toast.error('Số điểm điều chỉnh phải là số nguyên khác 0.');
      return;
    }
    if (!adjustment.lyDo.trim()) {
      toast.error('Vui lòng nhập lý do điều chỉnh điểm.');
      return;
    }

    setAdjustLoading(true);
    try {
      const response = await loyaltyApi.adjustPoints(adjustCustomer.maKhachHang, {
        soDiem: points,
        lyDo: adjustment.lyDo.trim(),
      });
      toast.success(messageOf(response, 'Điều chỉnh điểm thành công.'));
      setAdjustCustomer(null);
      setAdjustment(emptyAdjustment);
      loadCustomers();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể điều chỉnh điểm.'));
    } finally {
      setAdjustLoading(false);
    }
  }

  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, numberOfElements, totalElements);
  const earnMoney = Number(policy?.soTienDeNhanMotDiem || 10000);
  const pointValue = Number(policy?.giaTriMotDiem || 1000);
  const minimumPoints = Number(policy?.diemToiThieuDeDoi || 20);
  const maximumRatio = Number(policy?.tyLeThanhToanToiDaBangDiem || 0.2) * 100;

  return (
    <section className="loyalty-admin-page">
      <div className="loyalty-policy-grid">
        <article>
          <span><Award size={22} /></span>
          <div><small>Quy đổi tích điểm</small><strong>{formatMoney(earnMoney)} = 1 điểm</strong></div>
        </article>
        <article>
          <span><SlidersHorizontal size={22} /></span>
          <div><small>Giá trị sử dụng</small><strong>1 điểm = {formatMoney(pointValue)}</strong></div>
        </article>
        <article>
          <span><UserRound size={22} /></span>
          <div><small>Điều kiện đổi điểm</small><strong>Từ {minimumPoints} điểm · Tối đa {maximumRatio}%</strong></div>
        </article>
      </div>

      <div className="loyalty-admin-toolbar">
        <label className="loyalty-admin-search">
          <Search size={20} />
          <input
            value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setPage(0); }}
            placeholder="Tìm theo tên hoặc số điện thoại..."
          />
        </label>
        <button type="button" className="loyalty-admin-add" onClick={openCreate}><Plus size={19} />Thêm khách hàng</button>
      </div>

      <div className="loyalty-admin-table-card">
        <div className="loyalty-admin-table-wrap">
          <table className="loyalty-admin-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Loại khách</th>
                <th>Số đơn</th>
                <th>Điểm hiện có</th>
                <th>Tổng chi tiêu</th>
                <th>Trạng thái tài khoản</th>
                <th>Cập nhật gần nhất</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.map((customer, index) => (
                <tr key={customer.maKhachHang}>
                  <td>{page * size + index + 1}</td>
                  <td><strong>{customer.hoTen || 'Chưa cập nhật'}</strong></td>
                  <td>{customer.soDienThoai || '—'}</td>
                  <td><span className={`loyalty-customer-type ${customer.coTaiKhoan ? 'member' : 'guest'}`}>{customer.coTaiKhoan ? 'Thành viên' : 'Khách vãng lai'}</span></td>
                  <td><strong>{Number(customer.soDonHang || 0)}</strong></td>
                  <td><span className="loyalty-points-badge"><Award size={14} />{Number(customer.diemTichLuy || 0)} điểm</span></td>
                  <td><strong>{formatMoney(customer.tongChiTieu)}</strong></td>
                  <td>
                    {customer.coTaiKhoan ? (
                      <span className={`loyalty-status ${customer.trangThai === 'HOAT_DONG' ? 'active' : 'inactive'}`}>{customer.trangThai === 'HOAT_DONG' ? 'Hoạt động' : 'Đã khóa'}</span>
                    ) : <span className="loyalty-status guest">Chưa có tài khoản</span>}
                  </td>
                  <td>{dateTimeText(customer.thoiGianCapNhat)}</td>
                  <td>
                    <div className="loyalty-admin-actions">
                      <button type="button" title="Sửa thông tin" onClick={() => openEdit(customer)}><Pencil size={17} /></button>
                      <button type="button" title="Lịch sử điểm" onClick={() => openHistory(customer)}><History size={17} /></button>
                      <button type="button" title="Lịch sử đơn hàng" onClick={() => openOrders(customer)}><PackageSearch size={17} /></button>
                      <button type="button" className="adjust" title="Điều chỉnh điểm" onClick={() => openAdjust(customer)}><SlidersHorizontal size={17} /></button>
                      {customer.coTaiKhoan ? (
                        <button
                          type="button"
                          className={customer.trangThai === 'HOAT_DONG' ? 'lock-account' : 'unlock-account'}
                          title={customer.trangThai === 'HOAT_DONG' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          disabled={statusLoadingId === customer.maKhachHang}
                          onClick={() => toggleAccountStatus(customer)}
                        >
                          {customer.trangThai === 'HOAT_DONG' ? <Lock size={17} /> : <Unlock size={17} />}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr><td colSpan="10" className="loyalty-admin-empty">Đang tải danh sách khách hàng...</td></tr>
              ) : null}
              {!loading && rows.length === 0 ? (
                <tr><td colSpan="10" className="loyalty-admin-empty">Không tìm thấy khách hàng phù hợp.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="loyalty-admin-footer">
          <span>Hiển thị {displayRange.from} - {displayRange.to} trong tổng số {totalElements} khách hàng</span>
          <div className="loyalty-admin-pagination">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>‹</button>
            {pageItems.map((item) => (
              <button type="button" key={item} className={item === page ? 'current' : ''} onClick={() => setPage(item)}>{item + 1}</button>
            ))}
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={totalPages === 0 || page >= totalPages - 1}>›</button>
          </div>
          <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
            <option value="10">10 / trang</option>
            <option value="20">20 / trang</option>
            <option value="50">50 / trang</option>
          </select>
        </div>
      </div>

      {formOpen ? (
        <div className="loyalty-modal-backdrop" onMouseDown={closeForm}>
          <form className="loyalty-modal loyalty-customer-form" onSubmit={submitCustomer} onMouseDown={(event) => event.stopPropagation()}>
            <div className="loyalty-modal-head">
              <div><h3>{editingCustomer ? 'Cập nhật khách hàng' : 'Thêm khách hàng thân thiết'}</h3><p>Thông tin khách hàng được nhận diện bằng số điện thoại.</p></div>
              <button type="button" onClick={closeForm}><X size={20} /></button>
            </div>
            <div className="loyalty-modal-body">
              <label><span>Họ tên</span><input required maxLength="100" value={form.hoTen} onChange={(event) => setForm({ ...form, hoTen: event.target.value })} placeholder="Ví dụ: Nguyễn Văn An" /></label>
              <label><span>Số điện thoại</span><input required inputMode="numeric" value={form.soDienThoai} onChange={(event) => setForm({ ...form, soDienThoai: normalizePhone(event.target.value) })} placeholder="Ví dụ: 0979792909" /></label>
            </div>
            <div className="loyalty-modal-actions">
              <button type="button" className="secondary" onClick={closeForm} disabled={formLoading}>Hủy</button>
              <button type="submit" className="primary" disabled={formLoading}>{formLoading ? 'Đang lưu...' : editingCustomer ? 'Lưu thay đổi' : 'Thêm khách hàng'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {historyCustomer ? (
        <div className="loyalty-modal-backdrop" onMouseDown={closeHistory}>
          <div className="loyalty-modal loyalty-history-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="loyalty-modal-head">
              <div><h3>Lịch sử điểm</h3><p>{historyCustomer.hoTen} · {historyCustomer.soDienThoai}</p></div>
              <button type="button" onClick={closeHistory}><X size={20} /></button>
            </div>
            <div className="loyalty-history-summary">
              <article><span>Điểm hiện có</span><strong>{Number(historyCustomer.diemTichLuy || 0)} điểm</strong></article>
              <article><span>Tổng chi tiêu</span><strong>{formatMoney(historyCustomer.tongChiTieu)}</strong></article>
            </div>
            <div className="loyalty-history-table-wrap">
              <table className="loyalty-history-table">
                <thead><tr><th>Thời gian</th><th>Loại giao dịch</th><th>Đơn hàng</th><th>Số điểm</th><th>Số dư</th><th>Nội dung</th></tr></thead>
                <tbody>
                  {!historyLoading && transactions.map((item) => (
                    <tr key={item.maGiaoDichDiem}>
                      <td>{dateTimeText(item.thoiGian)}</td>
                      <td>{TRANSACTION_LABELS[item.loaiGiaoDich] || item.loaiGiaoDich}</td>
                      <td>{item.maDonHang ? `DH${String(item.maDonHang).padStart(7, '0')}` : '—'}</td>
                      <td><strong className={Number(item.soDiem) >= 0 ? 'points-plus' : 'points-minus'}>{Number(item.soDiem) >= 0 ? '+' : ''}{item.soDiem}</strong></td>
                      <td>{item.soDuSauGiaoDich}</td>
                      <td>{item.noiDung || '—'}</td>
                    </tr>
                  ))}
                  {historyLoading ? <tr><td colSpan="6" className="loyalty-admin-empty">Đang tải lịch sử điểm...</td></tr> : null}
                  {!historyLoading && transactions.length === 0 ? <tr><td colSpan="6" className="loyalty-admin-empty">Khách hàng chưa có giao dịch điểm.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {orderCustomer ? (
        <div className="loyalty-modal-backdrop" onMouseDown={closeOrders}>
          <div className="loyalty-modal loyalty-history-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="loyalty-modal-head">
              <div><h3>Lịch sử đơn hàng</h3><p>{orderCustomer.hoTen} · {orderCustomer.soDienThoai}</p></div>
              <button type="button" onClick={closeOrders}><X size={20} /></button>
            </div>
            <div className="loyalty-history-summary">
              <article><span>Tổng số đơn</span><strong>{Number(orderCustomer.soDonHang || orders.length || 0)} đơn</strong></article>
              <article><span>Tổng chi tiêu</span><strong>{formatMoney(orderCustomer.tongChiTieu)}</strong></article>
            </div>
            <div className="loyalty-history-table-wrap">
              <table className="loyalty-history-table loyalty-order-history-table">
                <thead><tr><th>Mã đơn</th><th>Loại đơn</th><th>Nguồn đơn</th><th>Trạng thái</th><th>Tổng tiền</th><th>Thời gian đặt</th></tr></thead>
                <tbody>
                  {!ordersLoading && orders.map((item) => (
                    <tr key={item.maDonHang}>
                      <td><strong>DH{String(item.maDonHang).padStart(7, '0')}</strong></td>
                      <td>{ORDER_TYPE_LABELS[item.loaiDon] || item.loaiDon || '—'}</td>
                      <td>{item.nguonDon === 'WEBSITE' ? 'Website' : item.nguonDon === 'QR' ? 'QR tại bàn' : item.nguonDon || '—'}</td>
                      <td><span className="loyalty-order-status">{ORDER_STATUS_LABELS[item.trangThai] || item.trangThai || '—'}</span></td>
                      <td><strong>{formatMoney(item.tongTien)}</strong></td>
                      <td>{dateTimeText(item.thoiGianDat)}</td>
                    </tr>
                  ))}
                  {ordersLoading ? <tr><td colSpan="6" className="loyalty-admin-empty">Đang tải lịch sử đơn hàng...</td></tr> : null}
                  {!ordersLoading && orders.length === 0 ? <tr><td colSpan="6" className="loyalty-admin-empty">Khách hàng chưa có đơn hàng được liên kết.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {adjustCustomer ? (
        <div className="loyalty-modal-backdrop" onMouseDown={closeAdjust}>
          <form className="loyalty-modal loyalty-adjust-modal" onSubmit={submitAdjustment} onMouseDown={(event) => event.stopPropagation()}>
            <div className="loyalty-modal-head">
              <div><h3>Điều chỉnh điểm</h3><p>{adjustCustomer.hoTen} hiện có {Number(adjustCustomer.diemTichLuy || 0)} điểm.</p></div>
              <button type="button" onClick={closeAdjust}><X size={20} /></button>
            </div>
            <div className="loyalty-modal-body">
              <label><span>Số điểm điều chỉnh</span><input required type="number" step="1" value={adjustment.soDiem} onChange={(event) => setAdjustment({ ...adjustment, soDiem: event.target.value })} placeholder="Nhập số dương để cộng, số âm để trừ" /><small>Ví dụ: 20 để cộng 20 điểm hoặc -10 để trừ 10 điểm.</small></label>
              <label><span>Lý do</span><textarea required rows="4" maxLength="255" value={adjustment.lyDo} onChange={(event) => setAdjustment({ ...adjustment, lyDo: event.target.value })} placeholder="Nhập lý do điều chỉnh điểm..." /></label>
            </div>
            <div className="loyalty-modal-actions">
              <button type="button" className="secondary" onClick={closeAdjust} disabled={adjustLoading}>Hủy</button>
              <button type="submit" className="primary" disabled={adjustLoading}>{adjustLoading ? 'Đang xử lý...' : 'Xác nhận điều chỉnh'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
