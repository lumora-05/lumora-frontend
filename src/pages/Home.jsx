import {
  ArrowRight,
  Bike,
  CalendarCheck2,
  ChefHat,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Gift,
  MapPin,
  Menu,
  Phone,
  Quote,
  QrCode,
  Sparkles,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { menuApi } from '../api/menuApi';
import { promotionApi } from '../api/promotionApi';
import { reviewApi } from '../api/reviewApi';
import LumoraChatbot from '../components/customer/LumoraChatbot';
import { formatMoney } from '../utils/formatMoney';
import { imageUrl } from '../utils/imageUrl';
import '../styles/home.css';

const RESTAURANT = {
  address: import.meta.env.VITE_RESTAURANT_ADDRESS || '139 Nguyễn Thị Thập, Thanh Khê, Đà Nẵng',
  phone: import.meta.env.VITE_RESTAURANT_PHONE || '0979792909',
};

const FEATURED_FOOD_LIMIT = 4;

const menuFallback = [
  {
    id: 'main-1',
    name: 'Món chính',
    category: 'Hương vị LUMORA',
    description: 'Các món chính được chuẩn bị chỉn chu và phục vụ nóng tại bàn.',
    image: '/lumora-home/dish-bo-luc-lac.png',
  },
  {
    id: 'main-2',
    name: 'Món đặc sắc',
    category: 'Gợi ý từ căn bếp',
    description: 'Những lựa chọn nổi bật dành cho một bữa ăn trọn vẹn tại LUMORA.',
    image: '/lumora-home/dish-ca-hoi.png',
  },
  {
    id: 'fresh',
    name: 'Món thanh nhẹ',
    category: 'Tươi mới',
    description: 'Lựa chọn cân bằng với rau xanh và nguyên liệu được chuẩn bị trong ngày.',
    image: '/lumora-home/dish-salad.png',
  },
  {
    id: 'dessert',
    name: 'Tráng miệng',
    category: 'Kết thúc ngọt ngào',
    description: 'Một điểm kết nhẹ nhàng để hoàn thiện trải nghiệm dùng bữa.',
    image: '/lumora-home/dish-dessert.png',
  },
];

const experienceItems = [
  {
    icon: QrCode,
    title: 'Quét QR tại bàn',
    text: 'Xem thực đơn và gửi món ngay tại bàn mà không cần chờ lấy menu giấy.',
  },
  {
    icon: CalendarCheck2,
    title: 'Đặt bàn trực tuyến',
    text: 'Chọn ngày, giờ và số khách; nhà hàng tiếp nhận và xác nhận yêu cầu.',
  },
  {
    icon: ChefHat,
    title: 'Theo dõi quá trình phục vụ',
    text: 'Đơn được chuyển đến khu vực xử lý để khách theo dõi trạng thái thuận tiện hơn.',
  },
  {
    icon: CreditCard,
    title: 'Thanh toán tiện lợi',
    text: 'Hỗ trợ quy trình thanh toán tại nhà hàng theo thông tin đơn thực tế.',
  },
];

const dineInSteps = [
  { icon: QrCode, step: '01', title: 'Quét QR', text: 'Quét mã QR trên bàn để mở đúng thực đơn và phiên phục vụ.' },
  { icon: UtensilsCrossed, step: '02', title: 'Chọn món', text: 'Xem món, số lượng và gửi đơn trực tiếp từ thiết bị của khách.' },
  { icon: ChefHat, step: '03', title: 'Bếp chế biến', text: 'Đơn được tiếp nhận để bếp chuẩn bị món theo trạng thái thực tế.' },
  { icon: CircleCheck, step: '04', title: 'Phục vụ tại bàn', text: 'Món hoàn thành được nhân viên phục vụ mang đến đúng bàn.' },
  { icon: CreditCard, step: '05', title: 'Thanh toán', text: 'Khách gửi yêu cầu thanh toán khi kết thúc bữa ăn.' },
];

function unwrapCollection(response) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function foodId(food, index) {
  return food?.maMonAn ?? food?.id ?? `food-${index}`;
}

function foodName(food) {
  return food?.tenMonAn ?? food?.name ?? 'Món ăn LUMORA';
}

function foodCategory(food) {
  return food?.danhMuc?.tenDanhMuc
    ?? food?.tenDanhMuc
    ?? food?.categoryName
    ?? food?.category
    ?? 'Món ăn';
}

function foodDescription(food) {
  return food?.moTa
    ?? food?.description
    ?? 'Món ăn được chuẩn bị và phục vụ tại nhà hàng LUMORA.';
}

function FoodImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  const localAsset = typeof src === 'string' && src.startsWith('/lumora-home/');
  const resolved = src ? (localAsset ? src : imageUrl(src)) : '';

  if (!resolved || failed) {
    return (
      <span className={`home-food-placeholder ${className}`} aria-hidden="true">
        <UtensilsCrossed size={38} />
      </span>
    );
  }

  return (
    <img
      className={className}
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function Stars({ value = 5 }) {
  const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className="home-stars" aria-label={`${rating} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} className={index < rating ? 'filled' : ''} />
      ))}
    </span>
  );
}

function promotionValue(promotion) {
  const value = Number(promotion?.giaTriGiam ?? promotion?.discountValue ?? 0);
  const type = String(promotion?.loaiGiam ?? promotion?.discountType ?? '').toUpperCase();
  if (!value) return 'Ưu đãi LUMORA';
  if (type === 'PERCENT' || type === 'PERCENTAGE') return `Giảm ${value}%`;
  return `Giảm ${formatMoney(value)}`;
}

function reviewName(review) {
  return review?.displayName
    ?? review?.customerName
    ?? review?.reviewerName
    ?? review?.tenHienThi
    ?? review?.tenKhachHang
    ?? 'Khách hàng LUMORA';
}

function reviewText(review) {
  return review?.comment
    ?? review?.noiDung
    ?? review?.content
    ?? 'Cảm ơn bạn đã lựa chọn và chia sẻ trải nghiệm tại LUMORA.';
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [foods, setFoods] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener('resize', closeMenu);
    return () => window.removeEventListener('resize', closeMenu);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      menuApi.getActive(),
      promotionApi.getActive(),
      reviewApi.publicPage({ page: 0, size: 3 }),
    ]).then(([menuResult, promotionResult, reviewResult]) => {
      if (!active) return;

      if (menuResult.status === 'fulfilled') {
        setFoods(
          unwrapCollection(menuResult.value)
            .filter((food) => food?.trangThai !== false)
            .slice(0, FEATURED_FOOD_LIMIT),
        );
      }
      if (promotionResult.status === 'fulfilled') {
        setPromotions(
          unwrapCollection(promotionResult.value)
            .filter((item) => item?.trangThai !== false)
            .slice(0, 3),
        );
      }
      if (reviewResult.status === 'fulfilled') {
        setReviews(unwrapCollection(reviewResult.value).slice(0, 3));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const displayedMenu = useMemo(
    () => (foods.length ? foods : menuFallback).slice(0, FEATURED_FOOD_LIMIT),
    [foods],
  );

  const scrollTo = (id) => (event) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  return (
    <main className="lumora-home">
      <header className="home-header">
        <div className="home-header-inner">
          <a className="home-brand" href="#top" onClick={scrollTo('top')} aria-label="LUMORA - Trang chủ">
            <span className="home-brand-mark"><Sparkles size={24} strokeWidth={1.8} /></span>
            <span className="home-brand-copy">
              <strong>LUMORA</strong>
              <small>Restaurant</small>
            </span>
          </a>

          <button
            className="home-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={`home-nav ${menuOpen ? 'open' : ''}`} aria-label="Điều hướng trang chủ">
            <a className="active" href="#top" onClick={scrollTo('top')}>Trang chủ</a>
            <a href="#menu" onClick={scrollTo('menu')}>Thực đơn</a>
            <Link to="/reservations" onClick={() => setMenuOpen(false)}>Đặt bàn</Link>
            <a href="#offers" onClick={scrollTo('offers')}>Khuyến mãi</a>
            <a href="#about" onClick={scrollTo('about')}>Giới thiệu</a>
            <a href="#contact" onClick={scrollTo('contact')}>Liên hệ</a>
            <Link className="home-nav-utility" to="/delivery" onClick={() => setMenuOpen(false)}>Giao tận nơi</Link>
            <Link className="home-nav-utility" to="/login" onClick={() => setMenuOpen(false)}>Đăng nhập</Link>
          </nav>

          <div className="home-header-actions">
            <Link className="home-delivery-link" to="/delivery"><Bike size={17} /> Giao tận nơi</Link>
            <Link className="home-login-link" to="/login">Đăng nhập</Link>
          </div>
        </div>
      </header>

      <section className="home-hero" id="top">
        <img className="home-hero-bg" src="/lumora-home/hero.png" alt="Không gian nhà hàng LUMORA" />
        <div className="home-hero-overlay" />
        <div className="home-container home-hero-content">
          <div className="home-hero-copy">
            <span className="home-hero-script">Trải nghiệm</span>
            <h1>Những khoảnh khắc<br />đáng nhớ tại <em>LUMORA</em></h1>
            <p>
              Không gian ấm cúng, món ăn được chuẩn bị chỉn chu và những tiện ích số
              giúp hành trình dùng bữa trở nên thuận tiện hơn.
            </p>
            <div className="home-hero-actions">
              <a className="home-primary-button" href="#menu" onClick={scrollTo('menu')}>
                Xem thực đơn <UtensilsCrossed size={17} />
              </a>
              <Link className="home-secondary-button" to="/reservations">
                Đặt bàn ngay <CalendarCheck2 size={17} />
              </Link>
            </div>
            <div className="home-hero-meta">
              <span><MapPin size={16} /> {RESTAURANT.address}</span>
              <span><QrCode size={16} /> Gọi món bằng QR tại bàn</span>
            </div>
          </div>

          <aside className="home-hero-feature" aria-label="Gọi món bằng mã QR">
            <span className="home-hero-feature-icon"><QrCode size={32} /></span>
            <small>TẠI NHÀ HÀNG</small>
            <strong>Quét QR trên bàn</strong>
            <p>Xem menu, gửi món và theo dõi đơn ngay trên điện thoại.</p>
            <span className="home-hero-feature-note">Nhanh chóng · Đúng bàn · Thuận tiện</span>
          </aside>
        </div>
        <div className="home-hero-dots" aria-hidden="true"><span className="active" /><span /><span /></div>
      </section>

      <section className="home-section home-menu-section" id="menu">
        <div className="home-container">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Thực đơn</span>
              <h2>Món ăn nổi bật</h2>
              <p>Một số lựa chọn được lấy trực tiếp từ thực đơn đang hoạt động của nhà hàng.</p>
            </div>
            <Link className="home-heading-action" to="/delivery">
              Xem thực đơn giao tận nơi <ChevronRight size={18} />
            </Link>
          </div>

          <div className="home-food-grid">
            {displayedMenu.map((item, index) => {
              const isFood = foods.length > 0;
              const name = foodName(item);
              const category = foodCategory(item);
              const description = foodDescription(item);
              const image = isFood ? (item.hinhAnh ?? item.image) : item.image;

              return (
                <article className="home-food-card" key={foodId(item, index)}>
                  <div className="home-food-image">
                    <FoodImage src={image} alt={name} />
                    <span className="home-food-category">{category}</span>
                  </div>
                  <div className="home-food-content">
                    <h3>{name}</h3>
                    <p>{description}</p>
                    <div className="home-food-bottom">
                      {isFood && item.gia != null
                        ? <strong>{formatMoney(item.gia)}</strong>
                        : <span>Khám phá tại LUMORA</span>}
                      <span className="home-food-arrow"><ArrowRight size={17} /></span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="home-menu-note">
            <QrCode size={21} />
            <p><strong>Dùng bữa tại nhà hàng?</strong> Quét mã QR trên bàn để xem đầy đủ thực đơn và gửi món cho đúng bàn của bạn.</p>
          </div>
        </div>
      </section>

      <section className="home-section home-offers-section" id="offers">
        <div className="home-container">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Ưu đãi</span>
              <h2>Khuyến mãi đang áp dụng</h2>
              <p>Thông tin được cập nhật từ các chương trình đang hoạt động trong hệ thống.</p>
            </div>
          </div>

          {promotions.length ? (
            <div className="home-offer-grid">
              {promotions.map((promotion, index) => (
                <article className="home-offer-card" key={promotion.maKhuyenMai ?? promotion.id ?? index}>
                  <div className="home-offer-top">
                    <span><Gift size={22} /></span>
                    <small>{promotionValue(promotion)}</small>
                  </div>
                  <h3>{promotion.tenKhuyenMai ?? promotion.name ?? 'Ưu đãi LUMORA'}</h3>
                  <p>{promotion.moTa ?? promotion.description ?? 'Chương trình ưu đãi dành cho thực khách tại LUMORA.'}</p>
                  {(promotion.maCode ?? promotion.code) ? (
                    <div className="home-offer-code"><span>Mã ưu đãi</span><strong>{promotion.maCode ?? promotion.code}</strong></div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="home-offer-empty">
              <span><Gift size={28} /></span>
              <div>
                <h3>Ưu đãi mới sẽ xuất hiện tại đây</h3>
                <p>Hệ thống hiện chưa có chương trình khuyến mãi công khai đang áp dụng.</p>
              </div>
              <Link to="/reservations">Đặt bàn <ArrowRight size={17} /></Link>
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-about-section" id="about">
        <div className="home-container home-about-grid">
          <div className="home-about-copy">
            <span className="home-section-kicker">Về LUMORA</span>
            <h2>Ẩm thực và công nghệ trong một trải nghiệm liền mạch.</h2>
            <p>
              LUMORA hướng đến không gian dùng bữa hiện đại, nơi thực khách có thể đặt bàn,
              gọi món tại bàn và tương tác với nhà hàng thuận tiện hơn mà vẫn giữ trọn cảm giác ấm cúng.
            </p>
            <Link className="home-text-link" to="/reservations">Đặt bàn tại LUMORA <ArrowRight size={17} /></Link>
          </div>

          <div className="home-about-visual">
            <img src="/lumora-home/dish-ca-hoi.png" alt="Món ăn được trình bày tại LUMORA" />
            <div className="home-about-badge"><ChefHat size={22} /><span><strong>Chỉn chu trong từng món</strong><small>Trải nghiệm hướng đến sự thuận tiện của thực khách</small></span></div>
          </div>
        </div>
      </section>

      <section className="home-section home-experience-section">
        <div className="home-container">
          <div className="home-section-heading home-section-heading-centered">
            <div>
              <span className="home-section-kicker">Trải nghiệm tại LUMORA</span>
              <h2>Thuận tiện từ lúc đặt bàn đến khi thanh toán</h2>
              <p>Các tiện ích được tổ chức theo đúng hành trình dùng bữa tại nhà hàng.</p>
            </div>
          </div>
          <div className="home-experience-grid">
            {experienceItems.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span><Icon size={24} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-reservation-banner">
        <div className="home-container home-reservation-grid">
          <div className="home-reservation-copy">
            <span className="home-section-kicker light">Đặt bàn trực tuyến</span>
            <h2>Chọn trước thời gian, sẵn sàng cho một bữa ăn trọn vẹn.</h2>
            <p>Gửi yêu cầu đặt bàn theo ngày, giờ và số lượng khách. Nhà hàng sẽ tiếp nhận và phản hồi trạng thái đặt bàn.</p>
            <div className="home-reservation-actions">
              <Link className="home-primary-button" to="/reservations">Đặt bàn ngay <CalendarCheck2 size={17} /></Link>
              <a className="home-reservation-phone" href={`tel:${RESTAURANT.phone.replace(/\s/g, '')}`}><Phone size={17} /> {RESTAURANT.phone}</a>
            </div>
          </div>
          <div className="home-reservation-benefits">
            <div><CalendarCheck2 size={21} /><span><strong>Gửi yêu cầu nhanh</strong><small>Thao tác trực tuyến trên website</small></span></div>
            <div><CircleCheck size={21} /><span><strong>Theo dõi trạng thái</strong><small>Tra cứu thông tin đặt bàn đã gửi</small></span></div>
            <div><Bike size={21} /><span><strong>Cần giao tận nơi?</strong><small>Có luồng đặt món giao hàng riêng</small></span></div>
          </div>
        </div>
      </section>

      <section className="home-section home-review-section" id="reviews">
        <div className="home-container">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Đánh giá</span>
              <h2>Khách hàng nói gì về LUMORA</h2>
              <p>Những phản hồi công khai được gửi sau trải nghiệm dùng bữa.</p>
            </div>
          </div>

          {reviews.length ? (
            <div className="home-review-grid">
              {reviews.map((review, index) => (
                <article className="home-review-card" key={review.maDanhGia ?? review.id ?? index}>
                  <div className="home-review-head"><span>{String(reviewName(review)).trim().charAt(0).toUpperCase() || 'L'}</span><div><strong>{reviewName(review)}</strong><Stars value={review.rating ?? review.soSao ?? review.star ?? 5} /></div><Quote size={25} /></div>
                  <p>{reviewText(review)}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="home-review-empty">
              <Quote size={29} />
              <div><h3>Trải nghiệm của bạn là điều LUMORA trân trọng</h3><p>Khách dùng bữa có thể gửi đánh giá từ trang dành cho bàn sau khi sử dụng dịch vụ.</p></div>
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-order-flow-section">
        <div className="home-container">
          <div className="home-section-heading home-section-heading-centered">
            <div>
              <span className="home-section-kicker">Gọi món tại bàn</span>
              <h2>Trải nghiệm gọi món tại LUMORA</h2>
              <p>Một quy trình rõ ràng từ lúc khách quét QR đến khi hoàn tất thanh toán.</p>
            </div>
          </div>
          <div className="home-flow-grid">
            {dineInSteps.map(({ icon: Icon, step, title, text }, index) => (
              <article key={step}>
                <span className="home-flow-number">{step}</span>
                <span className="home-flow-icon"><Icon size={25} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                {index < dineInSteps.length - 1 ? <ArrowRight className="home-flow-arrow" size={18} /> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-contact-section" id="contact">
        <div className="home-container home-contact-grid">
          <div>
            <span className="home-section-kicker">Liên hệ</span>
            <h2>Hẹn bạn tại LUMORA.</h2>
            <p>Thông tin dưới đây được lấy từ cấu hình nhà hàng của frontend và có thể thay đổi theo môi trường triển khai.</p>
          </div>
          <div className="home-contact-cards">
            <div><span><MapPin size={21} /></span><div><small>Địa chỉ</small><strong>{RESTAURANT.address}</strong></div></div>
            <a href={`tel:${RESTAURANT.phone.replace(/\s/g, '')}`}><span><Phone size={21} /></span><div><small>Điện thoại</small><strong>{RESTAURANT.phone}</strong></div></a>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-main">
            <div className="home-footer-brand">
              <a className="home-brand" href="#top" onClick={scrollTo('top')}>
                <span className="home-brand-mark"><Sparkles size={23} /></span>
                <span className="home-brand-copy"><strong>LUMORA</strong><small>Restaurant</small></span>
              </a>
              <p>Không gian ẩm thực hiện đại, ấm cúng và thuận tiện cho từng trải nghiệm dùng bữa.</p>
            </div>
            <div className="home-footer-links"><strong>Khám phá</strong><a href="#menu" onClick={scrollTo('menu')}>Thực đơn</a><a href="#offers" onClick={scrollTo('offers')}>Khuyến mãi</a><a href="#about" onClick={scrollTo('about')}>Giới thiệu</a></div>
            <div className="home-footer-links"><strong>Dịch vụ</strong><Link to="/reservations">Đặt bàn</Link><Link to="/delivery">Giao tận nơi</Link><Link to="/login">Đăng nhập nhân viên</Link></div>
            <div className="home-footer-contact"><strong>Thông tin liên hệ</strong><span><MapPin size={15} /> {RESTAURANT.address}</span><a href={`tel:${RESTAURANT.phone.replace(/\s/g, '')}`}><Phone size={15} /> {RESTAURANT.phone}</a></div>
          </div>
          <div className="home-footer-bottom"><p>© {new Date().getFullYear()} LUMORA Restaurant. Tất cả quyền được bảo lưu.</p><a href="#top" onClick={scrollTo('top')}>Về đầu trang <ArrowRight size={14} /></a></div>
        </div>
      </footer>

      <LumoraChatbot />
    </main>
  );
}
