import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  MessageSquareText,
  Search,
  Star,
} from 'lucide-react';
import { reviewApi } from '../../api/reviewApi';
import { useDebounce } from '../../hooks/useDebounce';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import { useWebSocket } from '../../hooks/useWebSocket';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function RatingStars({ rating }) {
  const value = Number(rating || 0);
  return (
    <span className="admin-review-stars" aria-label={`${value} sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={16} className={index < value ? 'filled' : ''} />
      ))}
    </span>
  );
}

const EMPTY_STATS = {
  totalReviews: 0,
  averageRating: 0,
  visibleReviews: 0,
  hiddenReviews: 0,
  ratingDistribution: {},
};

export default function ReviewManage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [keyword, setKeyword] = useState('');
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [changingId, setChangingId] = useState(null);
  const debouncedKeyword = useDebounce(keyword, 350);
  const socketEvent = useWebSocket(['/topic/reviews']);

  async function loadRows() {
    try {
      setLoading(true);
      const response = await reviewApi.adminPage({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
        rating: rating || undefined,
        status,
        from: from || undefined,
        to: to || undefined,
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
      toast.error(errorMessageOf(error, 'Không thể tải danh sách đánh giá.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadStatistics() {
    try {
      const response = await reviewApi.adminStatistics();
      setStats({ ...EMPTY_STATS, ...(response?.data ?? response ?? {}) });
    } catch {
      setStats(EMPTY_STATS);
    }
  }

  useEffect(() => {
    loadRows();
  }, [page, size, debouncedKeyword, rating, status, from, to]);

  useEffect(() => {
    loadStatistics();
  }, []);

  useEffect(() => {
    if (socketEvent?.topic === '/topic/reviews') {
      loadRows();
      loadStatistics();
    }
  }, [socketEvent]);

  async function toggleVisibility(review) {
    const nextVisible = review.visible === false;
    try {
      setChangingId(review.id);
      const response = await reviewApi.updateVisibility(review.id, nextVisible);
      toast.success(messageOf(response, nextVisible ? 'Đã hiển thị đánh giá.' : 'Đã ẩn đánh giá.'));
      await Promise.all([loadRows(), loadStatistics()]);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật trạng thái đánh giá.'));
    } finally {
      setChangingId(null);
    }
  }

  function clearFilters() {
    setKeyword('');
    setRating('');
    setStatus('ALL');
    setFrom('');
    setTo('');
    setPage(0);
  }

  const pageItems = paginationItems(page, totalPages);
  const range = pageDisplayRange(page, size, numberOfElements, totalElements);
  const average = Number(stats.averageRating || 0);

  return (
    <section className="admin-review-page">
      <div className="admin-review-kpis">
        <article>
          <span><MessageSquareText size={21} /></span>
          <p>Tổng đánh giá<strong>{stats.totalReviews}</strong></p>
        </article>
        <article>
          <span><Star size={21} /></span>
          <p>Điểm trung bình<strong>{average.toFixed(1)}/5</strong></p>
        </article>
        <article>
          <span><Eye size={21} /></span>
          <p>Đang hiển thị<strong>{stats.visibleReviews}</strong></p>
        </article>
        <article>
          <span><EyeOff size={21} /></span>
          <p>Đã ẩn<strong>{stats.hiddenReviews}</strong></p>
        </article>
      </div>

      <div className="admin-review-toolbar">
        <label className="admin-review-search">
          <Search size={19} />
          <input
            value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setPage(0); }}
            placeholder="Tìm mã hoặc nội dung đánh giá..."
          />
        </label>
        <select value={rating} onChange={(event) => { setRating(event.target.value); setPage(0); }}>
          <option value="">Tất cả số sao</option>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
        </select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
          <option value="ALL">Tất cả trạng thái</option>
          <option value="VISIBLE">Đang hiển thị</option>
          <option value="HIDDEN">Đã ẩn</option>
        </select>
        <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} title="Từ ngày" />
        <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} title="Đến ngày" />
        <button type="button" onClick={clearFilters}>Xóa lọc</button>
      </div>

      <div className="admin-review-table-card">
        <div className="admin-review-table-scroll">
          <table className="admin-review-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Điểm</th>
                <th>Nhận xét</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan="6" className="admin-review-empty">Đang tải đánh giá...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="admin-review-empty">Không tìm thấy đánh giá phù hợp.</td></tr>
              ) : rows.map((review) => (
                <tr key={review.id}>
                  <td><strong>#{review.id}</strong></td>
                  <td><RatingStars rating={review.rating} /><small>{review.rating}/5</small></td>
                  <td className="admin-review-comment">{review.comment || <em>Không có nhận xét</em>}</td>
                  <td>{formatDate(review.createdAt)}</td>
                  <td>
                    <span className={review.visible === false ? 'admin-review-status hidden' : 'admin-review-status visible'}>
                      {review.visible === false ? 'Đã ẩn' : 'Đang hiển thị'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={review.visible === false ? 'admin-review-action show' : 'admin-review-action hide'}
                      disabled={changingId === review.id}
                      onClick={() => toggleVisibility(review)}
                      title={review.visible === false ? 'Hiển thị đánh giá' : 'Ẩn đánh giá'}
                    >
                      {review.visible === false ? <Eye size={17} /> : <EyeOff size={17} />}
                      {changingId === review.id ? 'Đang lưu' : review.visible === false ? 'Hiển thị' : 'Ẩn'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-review-footer">
          <span>Hiển thị {range.from} - {range.to} trong tổng số {totalElements} đánh giá</span>
          <div className="admin-review-pagination">
            <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>‹</button>
            {pageItems.map((item) => (
              <button type="button" key={item} className={item === page ? 'current' : ''} onClick={() => setPage(item)}>{item + 1}</button>
            ))}
            <button type="button" disabled={totalPages === 0 || page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>›</button>
          </div>
          <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
            <option value="10">10 / trang</option>
            <option value="20">20 / trang</option>
            <option value="50">50 / trang</option>
          </select>
        </div>
      </div>
    </section>
  );
}
