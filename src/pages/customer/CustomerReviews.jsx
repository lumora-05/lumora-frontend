import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CircleCheck,
  Info,
  LoaderCircle,
  MessageSquareText,
  Quote,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { reviewApi } from '../../api/reviewApi';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { normalizePage } from '../../utils/pagination';
import { useWebSocket } from '../../hooks/useWebSocket';

function unwrapData(response, fallback) {
  return response?.data ?? response ?? fallback;
}

function formatReviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function StarRow({ value, size = 18 }) {
  return (
    <span className="customer-review-star-row" aria-label={`${value} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={size} className={index < value ? 'filled' : ''} />
      ))}
    </span>
  );
}

function visibleReviewCount(statistics) {
  const visible = statistics?.visibleReviews;
  if (visible !== null && visible !== undefined) return Number(visible || 0);
  return Number(statistics?.totalReviews || 0);
}

function getReviewDisplayName(review) {
  const value = review?.displayName
    ?? review?.customerName
    ?? review?.reviewerName
    ?? review?.name
    ?? review?.tenHienThi
    ?? review?.tenKhachHang;
  return String(value ?? '').trim() || 'Khách hàng ẩn danh';
}

function getInitials(name) {
  if (!name || name === 'Khách hàng ẩn danh') return <UserRound size={20} />;
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase();
}

function reviewSubmittedKey(qrToken) {
  return `lumora_review_submitted_${qrToken || 'unknown'}`;
}

function hasSubmittedReview(qrToken) {
  try {
    return window.sessionStorage.getItem(reviewSubmittedKey(qrToken)) === 'true';
  } catch {
    return false;
  }
}

function rememberSubmittedReview(qrToken) {
  try {
    window.sessionStorage.setItem(reviewSubmittedKey(qrToken), 'true');
  } catch {
    // Vẫn hiển thị lời cảm ơn trong phiên hiện tại nếu trình duyệt chặn sessionStorage.
  }
}

const EMPTY_STATS = {
  totalReviews: 0,
  averageRating: 0,
  visibleReviews: null,
  hiddenReviews: 0,
  ratingDistribution: {},
};

export default function CustomerReviews() {
  const toast = useToast();
  const { qrToken } = useParams();
  const [displayName, setDisplayName] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(() => hasSubmittedReview(qrToken));
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statisticsError, setStatisticsError] = useState('');
  const [reviewsError, setReviewsError] = useState('');
  const [statistics, setStatistics] = useState(EMPTY_STATS);
  const [reviews, setReviews] = useState([]);
  const socketEvent = useWebSocket(['/topic/reviews']);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setStatisticsError('');
    setReviewsError('');

    const [statisticsResult, reviewsResult] = await Promise.allSettled([
      reviewApi.publicStatistics(),
      reviewApi.publicPage({ page: 0, size: 6 }),
    ]);

    if (statisticsResult.status === 'fulfilled') {
      setStatistics({ ...EMPTY_STATS, ...unwrapData(statisticsResult.value, EMPTY_STATS) });
    } else {
      setStatisticsError(errorMessageOf(statisticsResult.reason, 'Chưa thể tải điểm đánh giá.'));
    }

    if (reviewsResult.status === 'fulfilled') {
      setReviews(normalizePage(reviewsResult.value, 6).content);
    } else {
      setReviewsError(errorMessageOf(reviewsResult.reason, 'Chưa thể tải danh sách đánh giá.'));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (socketEvent?.topic === '/topic/reviews') loadReviews();
  }, [socketEvent, loadReviews]);

  const distribution = useMemo(() => {
    const total = visibleReviewCount(statistics);
    return [5, 4, 3, 2, 1].map((star) => {
      const count = Number(
        statistics.ratingDistribution?.[star]
        ?? statistics.ratingDistribution?.[String(star)]
        ?? 0,
      );
      return {
        star,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }, [statistics]);

  async function submitReview(event) {
    event.preventDefault();
    if (!rating) {
      toast.info('Vui lòng chọn số sao trước khi gửi đánh giá.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await reviewApi.create({
        displayName: displayName.trim() || null,
        rating,
        comment: comment.trim() || null,
      });
      rememberSubmittedReview(qrToken);
      setSubmitted(true);
      toast.success(messageOf(response, 'Cảm ơn bạn đã gửi đánh giá.'));
      setDisplayName('');
      setRating(0);
      setHoverRating(0);
      setComment('');
      await loadReviews();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể gửi đánh giá. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoverRating || rating;
  const average = Number(statistics.averageRating || 0);
  const totalReviews = visibleReviewCount(statistics);

  return (
    <main className="customer-flow-page customer-review-page customer-menu-bg-page">
      <CustomerHeader />

      <section className="customer-review-container">
        <div className="customer-review-heading">
          <span><MessageSquareText size={15} /> Chia sẻ cùng LUMORA</span>
          <h1>Đánh giá trải nghiệm</h1>
          <p>Ý kiến của bạn rất quan trọng để LUMORA ngày càng hoàn thiện và phục vụ tốt hơn.</p>
        </div>

        <div className="customer-review-main-grid">
          {submitted ? (
            <div className="customer-review-form-card customer-review-thank-you" role="status" aria-live="polite">
              <span className="customer-review-thank-you-icon"><CircleCheck size={42} /></span>
              <span className="customer-review-thank-you-label">Đánh giá đã được ghi nhận</span>
              <h2>Cảm ơn bạn đã gửi đánh giá!</h2>
              <p>Ý kiến của bạn giúp LUMORA cải thiện chất lượng và phục vụ tốt hơn mỗi ngày.</p>
              <div className="customer-review-thank-you-note">
                <Sparkles size={18} />
                <span>Nhà hàng trân trọng mọi chia sẻ từ bạn.</span>
              </div>
            </div>
          ) : (
            <form className="customer-review-form-card" onSubmit={submitReview}>
              <div className="customer-review-card-title">
                <span><MessageSquareText size={22} /></span>
                <div>
                  <h2>Cảm nhận của bạn</h2>
                  <p>Chia sẻ đánh giá để chúng tôi phục vụ bạn tốt hơn.</p>
                </div>
              </div>

              <label className="customer-review-name-field">
                <span>Tên hiển thị <small>(không bắt buộc)</small></span>
                <input
                  type="text"
                  maxLength="50"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Ví dụ: Nguyễn Long hoặc để trống để đánh giá ẩn danh"
                  autoComplete="name"
                />
              </label>

              <div className="customer-review-rating-field">
                <strong>Bạn đánh giá LUMORA thế nào?</strong>
                <div className="customer-review-star-picker" onMouseLeave={() => setHoverRating(0)}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const starValue = index + 1;
                    return (
                      <button
                        type="button"
                        key={starValue}
                        className={starValue <= displayRating ? 'selected' : ''}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onFocus={() => setHoverRating(starValue)}
                        onBlur={() => setHoverRating(0)}
                        onClick={() => setRating(starValue)}
                        aria-label={`${starValue} sao`}
                      >
                        <Star size={40} />
                      </button>
                    );
                  })}
                </div>
                <span className="customer-review-rating-label">
                  {displayRating === 1 && 'Chưa hài lòng'}
                  {displayRating === 2 && 'Cần cải thiện'}
                  {displayRating === 3 && 'Bình thường'}
                  {displayRating === 4 && 'Hài lòng'}
                  {displayRating === 5 && 'Rất hài lòng'}
                  {!displayRating && 'Chạm vào ngôi sao để đánh giá'}
                </span>
              </div>

              <label className="customer-review-comment-field">
                <span>Chia sẻ thêm nhận xét <small>(không bắt buộc)</small></span>
                <textarea
                  rows="5"
                  maxLength="500"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Hãy chia sẻ điều bạn hài lòng hoặc góp ý để LUMORA phục vụ tốt hơn..."
                />
                <b>{comment.length}/500</b>
              </label>

              <button className="customer-review-submit" type="submit" disabled={submitting || !rating}>
                {submitting ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}
                {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
              <p className="customer-review-form-note">
                <CircleCheck size={15} />
                Đánh giá của bạn giúp chúng tôi phục vụ tốt hơn mỗi ngày.
              </p>
            </form>
          )}

          <aside className="customer-review-summary-card">
            <div className="customer-review-summary-title">
              <span><BarChart3 size={21} /></span>
              <h2>Điểm đánh giá</h2>
            </div>

            <div className="customer-review-score">
              <strong>{loading && !statisticsError ? '—' : average.toFixed(1)}</strong>
              <StarRow value={Math.round(average)} size={24} />
              <p>Dựa trên {totalReviews} lượt đánh giá</p>
              {statisticsError ? <small>{statisticsError}</small> : null}
            </div>

            <div className="customer-review-distribution">
              {distribution.map((item) => (
                <div key={item.star}>
                  <span>{item.star} <Star size={14} /></span>
                  <i><b style={{ width: `${item.percent}%` }} /></i>
                  <em>{item.count}</em>
                </div>
              ))}
            </div>

            <div className="customer-review-summary-note">
              <Info size={21} />
              <p><strong>Mọi ý kiến đóng góp đều được chúng tôi</strong><span>trân trọng và ghi nhận.</span></p>
            </div>
          </aside>
        </div>

        <section className="customer-public-reviews">
          <div className="customer-public-reviews-head">
            <div>
              <span>Khách hàng chia sẻ</span>
              <h2>Đánh giá gần đây</h2>
            </div>
            <button type="button" onClick={loadReviews} disabled={loading}>
              <RefreshCw className={loading ? 'spin' : ''} size={17} /> Làm mới
            </button>
          </div>

          {loading ? (
            <div className="customer-review-loading"><LoaderCircle className="spin" size={28} /> Đang tải đánh giá...</div>
          ) : reviewsError ? (
            <div className="customer-review-loading error">{reviewsError}</div>
          ) : reviews.length === 0 ? (
            <div className="customer-review-empty">
              <Quote size={32} />
              <h3>Chưa có đánh giá nào</h3>
              <p>Hãy là người đầu tiên chia sẻ cảm nhận về LUMORA.</p>
            </div>
          ) : (
            <div className="customer-public-review-grid">
              {reviews.map((review, index) => {
                const name = getReviewDisplayName(review);
                return (
                  <article key={review.id} className="customer-public-review-card">
                    <div className="customer-public-review-card-head">
                      <span className={`customer-review-avatar tone-${(index % 3) + 1}`}>
                        {getInitials(name)}
                      </span>
                      <p><strong>{name}</strong><small>{formatReviewDate(review.createdAt)}</small></p>
                      <StarRow value={Number(review.rating || 0)} size={16} />
                    </div>
                    <p>{review.comment || 'Khách hàng đã để lại đánh giá cho trải nghiệm tại LUMORA.'}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
