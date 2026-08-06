import {
  ArrowRight,
  Bike,
  CalendarCheck2,
  ChefHat,
  ChevronRight,
  Clock3,
  Gift,
  Heart,
  Leaf,
  MapPin,
  Menu,
  Phone,
  Quote,
  Sparkles,
  Star,
  UtensilsCrossed,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { menuApi } from '../api/menuApi';
import { promotionApi } from '../api/promotionApi';
import { reviewApi } from '../api/reviewApi';
import { formatMoney } from '../utils/formatMoney';
import { imageUrl } from '../utils/imageUrl';
import LumoraChatbot from '../components/customer/LumoraChatbot';
import '../styles/home.css';

const RESTAURANT = {
  name: import.meta.env.VITE_RESTAURANT_NAME || 'NHÀ HÀNG LUMORA',
  address: import.meta.env.VITE_RESTAURANT_ADDRESS || '139 Nguyễn Thị Thập, Thanh Khê, Đà Nẵng',
  phone: import.meta.env.VITE_RESTAURANT_PHONE || '0979792909',
};

const FEATURED_FOOD_LIMIT = 4;

const menuFallback = [
  {
    id: 'starter',
    emoji: '🥗',
    name: 'Món khai vị',
    category: 'Bắt đầu bữa ăn',
    description: 'Những lựa chọn nhẹ nhàng giúp đánh thức vị giác trước món chính.',
  },
  {
    id: 'main',
    emoji: '🍽️',
    name: 'Món chính',
    category: 'Hương vị đặc trưng',
    description: 'Thực đơn đa dạng, được chuẩn bị chỉn chu và phục vụ nóng tại bàn.',
  },
  {
    id: 'drink',
    emoji: '🥤',
    name: 'Đồ uống',
    category: 'Tươi mát',
    description: 'Các loại thức uống phù hợp để dùng kèm trong suốt bữa ăn.',
  },
  {
    id: 'dessert',
    emoji: '🍰',
    name: 'Món tráng miệng',
    category: 'Kết thúc ngọt ngào',
    description: 'Một điểm kết nhẹ nhàng và trọn vẹn cho trải nghiệm tại LUMORA.',
  },
];

const restaurantValues = [
  {
    icon: Leaf,
    title: 'Nguyên liệu chọn lọc',
    text: 'Món ăn được chuẩn bị từ nguyên liệu phù hợp với tiêu chuẩn phục vụ của nhà hàng.',
  },
  {
    icon: ChefHat,
    title: 'Chế biến chỉn chu',
    text: 'Mỗi món được hoàn thiện cẩn thận từ hương vị đến cách trình bày.',
  },
  {
    icon: Heart,
    title: 'Phục vụ tận tâm',
    text: 'Không gian và quy trình phục vụ hướng đến sự thoải mái của từng thực khách.',
  },
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
    ?? 'Món ăn';
}

function foodDescription(food) {
  return food?.moTa
    ?? food?.description
    ?? 'Món ăn được chuẩn bị và phục vụ tại nhà hàng LUMORA.';
}

function FoodImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  const resolved = src ? imageUrl(src) : '';

  if (!resolved || failed) {
    return (
      <span className={`home-food-placeholder ${className}`} aria-hidden="true">
        <UtensilsCrossed size={42} />
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
  if (!value) return 'Ưu đãi';
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
        setPromotions(unwrapCollection(promotionResult.value).filter((item) => item?.trangThai !== false).slice(0, 3));
      }
      if (reviewResult.status === 'fulfilled') {
        setReviews(unwrapCollection(reviewResult.value).slice(0, 3));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const heroFood = foods[0] ?? null;
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
            <span className="home-brand-mark"><UtensilsCrossed size={23} strokeWidth={2.35} /></span>
            <span className="home-brand-copy">
              <strong>LUMORA</strong>
              <small>Nhà hàng &amp; Ẩm thực</small>
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
            <a href="#top" onClick={scrollTo('top')}>Trang chủ</a>
            <a href="#menu" onClick={scrollTo('menu')}>Thực đơn</a>
            <a href="#about" onClick={scrollTo('about')}>Giới thiệu</a>
            <a href="#offers" onClick={scrollTo('offers')}>Ưu đãi</a>
            <a href="#contact" onClick={scrollTo('contact')}>Liên hệ</a>
            <Link to="/delivery">Giao tận nơi</Link>
            <Link className="home-book-link" to="/login">
              Đăng nhập
              <ArrowRight size={17} />
            </Link>
          </nav>
        </div>
      </header>

      <section className="home-hero" id="top">
        <div className="home-hero-glow home-hero-glow-one" />
        <div className="home-hero-glow home-hero-glow-two" />

        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <span className="home-kicker"><Sparkles size={15} /> Ẩm thực tinh tế · Không gian ấm cúng</span>
            <h1>Thưởng thức hương vị đặc biệt tại <em>LUMORA.</em></h1>
            <p>
              Khám phá thực đơn đa dạng được chuẩn bị chỉn chu, tận hưởng không gian gần gũi
              và đặt bàn thuận tiện chỉ trong vài bước.
            </p>

            <div className="home-hero-actions">
              <a className="home-primary-button" href="#menu" onClick={scrollTo('menu')}>
                Xem thực đơn
                <ArrowRight size={18} />
              </a>
              <Link className="home-secondary-button" to="/reservations">
                <CalendarCheck2 size={18} />
                Đặt bàn ngay
              </Link>
              <Link className="home-delivery-button" to="/delivery">
                <Bike size={18} />
                Đặt món giao tận nơi
              </Link>
            </div>

            <div className="home-hero-notes" aria-label="Điểm nổi bật">
              <span><Leaf size={17} /> Nguyên liệu chọn lọc</span>
              <span><ChefHat size={17} /> Chế biến chỉn chu</span>
              <span><Heart size={17} /> Phục vụ tận tâm</span>
            </div>
          </div>

          <div className="home-hero-visual" aria-label="Món ăn nổi bật của nhà hàng">
            <div className="home-hero-image-card">
              {heroFood ? (
                <FoodImage src={heroFood.hinhAnh ?? heroFood.image} alt={foodName(heroFood)} />
              ) : (
                <span className="home-hero-dish-placeholder" aria-hidden="true">
                  <span>🍽️</span>
                </span>
              )}
              <div className="home-hero-image-overlay" />
              <div className="home-hero-food-copy">
                <small>{heroFood ? foodCategory(heroFood) : 'Trải nghiệm tại LUMORA'}</small>
                <strong>{heroFood ? foodName(heroFood) : 'Hương vị được chuẩn bị cho từng khoảnh khắc'}</strong>
                {heroFood?.gia != null ? <span>{formatMoney(heroFood.gia)}</span> : null}
              </div>
            </div>

            <div className="home-floating-card home-floating-card-top">
              <span><CalendarCheck2 size={20} /></span>
              <div><strong>Đặt bàn trực tuyến</strong><small>Gửi yêu cầu nhanh chóng</small></div>
            </div>
            <div className="home-floating-card home-floating-card-bottom">
              <span><Users size={20} /></span>
              <div><strong>Không gian gần gũi</strong><small>Phù hợp cho những buổi gặp gỡ</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-experience-strip" aria-label="Giá trị của nhà hàng">
        <div className="home-container home-experience-grid">
          {restaurantValues.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span><Icon size={22} /></span>
              <div>
                <strong>{title}</strong>
                <small>{text}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-menu-section" id="menu">
        <div className="home-container">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker"><UtensilsCrossed size={15} /> Hương vị LUMORA</span>
              <h2>Món ngon được yêu thích</h2>
              <p>
                Một số món ăn nổi bật được lựa chọn để giới thiệu trên trang chủ.
              </p>
            </div>
            <Link className="home-heading-action" to="/reservations">
              Đặt bàn để trải nghiệm <ChevronRight size={18} />
            </Link>
          </div>

          <div className={`home-food-grid ${foods.length ? '' : 'fallback'}`}>
            {displayedMenu.map((item, index) => {
              const isFood = foods.length > 0;
              const name = isFood ? foodName(item) : item.name;
              const category = isFood ? foodCategory(item) : item.category;
              const description = isFood ? foodDescription(item) : item.description;

              return (
                <article className="home-food-card" key={isFood ? foodId(item, index) : item.id}>
                  <div className="home-food-image">
                    {isFood ? (
                      <FoodImage src={item.hinhAnh ?? item.image} alt={name} />
                    ) : (
                      <span className="home-food-emoji" aria-hidden="true">{item.emoji}</span>
                    )}
                    <span className="home-food-category">{category}</span>
                  </div>
                  <div className="home-food-content">
                    <h3>{name}</h3>
                    <p>{description}</p>
                    <div className="home-food-bottom">
                      {isFood && item.gia != null
                        ? <strong>{formatMoney(item.gia)}</strong>
                        : <strong>Khám phá tại nhà hàng</strong>}
                      <span aria-hidden="true"><ArrowRight size={17} /></span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="home-menu-note">
            <span><Sparkles size={18} /></span>
            <p>
              Khi dùng bữa tại nhà hàng, bạn có thể quét mã QR tại bàn để xem đầy đủ thực đơn,
              tình trạng món và gửi yêu cầu gọi món.
            </p>
          </div>
        </div>
      </section>

      <section className="home-section home-about-section" id="about">
        <div className="home-container home-about-grid">
          <div className="home-about-visual" aria-hidden="true">
            <div className="home-about-card home-about-card-main">
              <span><UtensilsCrossed size={34} /></span>
              <strong>Mỗi bữa ăn là một trải nghiệm đáng nhớ.</strong>
              <small>LUMORA Restaurant</small>
            </div>
            <div className="home-about-card home-about-card-small">
              <ChefHat size={28} />
              <span>Chỉn chu trong từng món ăn</span>
            </div>
          </div>

          <div className="home-about-copy">
            <span className="home-section-kicker"><Heart size={15} /> Câu chuyện LUMORA</span>
            <h2>Nơi hương vị và những khoảnh khắc đáng nhớ gặp nhau.</h2>
            <p>
              LUMORA hướng đến một không gian ẩm thực hiện đại nhưng gần gũi, nơi thực khách
              có thể thoải mái thưởng thức món ăn cùng gia đình, bạn bè và đồng nghiệp.
            </p>
            <p>
              Từ khâu lựa chọn món, đặt bàn đến phục vụ tại bàn, mọi điểm chạm đều được
              sắp xếp để trải nghiệm của bạn thuận tiện và trọn vẹn hơn.
            </p>

            <div className="home-about-points">
              <div><span>01</span><strong>Thực đơn đa dạng</strong><small>Nhiều lựa chọn cho từng khẩu vị và dịp gặp gỡ.</small></div>
              <div><span>02</span><strong>Không gian ấm cúng</strong><small>Phù hợp cho bữa ăn gia đình, bạn bè và nhóm nhỏ.</small></div>
              <div><span>03</span><strong>Phục vụ thuận tiện</strong><small>Đặt bàn trực tuyến và gọi món bằng mã QR tại bàn.</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-offers-section" id="offers">
        <div className="home-container">
          <div className="home-section-heading home-section-heading-centered">
            <div>
              <span className="home-section-kicker"><Gift size={15} /> Dành cho thực khách</span>
              <h2>Ưu đãi tại LUMORA</h2>
              <p>Các chương trình đang áp dụng sẽ được cập nhật trực tiếp từ hệ thống nhà hàng.</p>
            </div>
          </div>

          {promotions.length ? (
            <div className="home-offer-grid">
              {promotions.map((promotion, index) => (
                <article className="home-offer-card" key={promotion.maKhuyenMai ?? promotion.id ?? index}>
                  <span className="home-offer-icon"><Gift size={24} /></span>
                  <small>{promotionValue(promotion)}</small>
                  <h3>{promotion.tenKhuyenMai ?? promotion.name ?? 'Ưu đãi LUMORA'}</h3>
                  <p>{promotion.moTa ?? promotion.description ?? 'Chương trình ưu đãi dành cho thực khách tại nhà hàng.'}</p>
                  {(promotion.maCode ?? promotion.code) ? (
                    <div className="home-offer-code">
                      <span>Mã ưu đãi</span>
                      <strong>{promotion.maCode ?? promotion.code}</strong>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="home-offer-empty">
              <span><Gift size={30} /></span>
              <div>
                <h3>Chương trình ưu đãi đang được cập nhật</h3>
                <p>Vui lòng theo dõi trang chủ hoặc liên hệ nhà hàng để biết chương trình mới nhất.</p>
              </div>
              <Link to="/reservations">Đặt bàn <ArrowRight size={17} /></Link>
            </div>
          )}
        </div>
      </section>

      <section className="home-reservation-banner">
        <div className="home-container home-reservation-grid">
          <div>
            <span className="home-section-kicker light"><CalendarCheck2 size={15} /> Đặt bàn trực tuyến</span>
            <h2>Chuẩn bị cho một bữa ăn trọn vẹn tại LUMORA.</h2>
            <p>
              Chọn ngày, thời gian và số lượng khách. Nhà hàng sẽ tiếp nhận yêu cầu
              và phản hồi thông tin đặt bàn của bạn.
            </p>
          </div>
          <div className="home-reservation-actions">
            <Link className="home-reservation-button" to="/reservations">
              Đặt bàn ngay <ArrowRight size={18} />
            </Link>
            <a className="home-reservation-phone" href={`tel:${RESTAURANT.phone.replace(/\s/g, '')}`}>
              <Phone size={18} />
              <span><small>Liên hệ đặt bàn</small><strong>{RESTAURANT.phone}</strong></span>
            </a>
          </div>
        </div>
      </section>

      <section className="home-section home-review-section" id="reviews">
        <div className="home-container">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker"><Quote size={15} /> Chia sẻ từ thực khách</span>
              <h2>Trải nghiệm tại LUMORA</h2>
              <p>Những phản hồi công khai được gửi từ khách hàng sau khi dùng bữa tại nhà hàng.</p>
            </div>
          </div>

          {reviews.length ? (
            <div className="home-review-grid">
              {reviews.map((review, index) => (
                <article className="home-review-card" key={review.maDanhGia ?? review.id ?? index}>
                  <Quote className="home-review-quote" size={29} />
                  <Stars value={review.rating ?? review.soSao ?? review.star ?? 5} />
                  <p>{reviewText(review)}</p>
                  <div>
                    <span>{String(reviewName(review)).trim().charAt(0).toUpperCase() || 'L'}</span>
                    <strong>{reviewName(review)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="home-review-empty">
              <Quote size={30} />
              <h3>Trải nghiệm của bạn là điều LUMORA trân trọng</h3>
              <p>Sau khi dùng bữa, khách hàng có thể gửi đánh giá trực tiếp trên trang dành cho bàn.</p>
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-contact-section" id="contact">
        <div className="home-container home-contact-grid">
          <div className="home-contact-copy">
            <span className="home-section-kicker"><MapPin size={15} /> Ghé thăm LUMORA</span>
            <h2>Chúng tôi sẵn sàng đón bạn.</h2>
            <p>
              Liên hệ nhà hàng hoặc gửi yêu cầu đặt bàn trực tuyến để chuẩn bị tốt hơn
              cho buổi gặp gỡ của bạn.
            </p>

            <div className="home-contact-list">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RESTAURANT.address)}`} target="_blank" rel="noreferrer">
                <span><MapPin size={21} /></span>
                <div><small>Địa chỉ</small><strong>{RESTAURANT.address}</strong></div>
              </a>
              <a href={`tel:${RESTAURANT.phone.replace(/\s/g, '')}`}>
                <span><Phone size={21} /></span>
                <div><small>Số điện thoại</small><strong>{RESTAURANT.phone}</strong></div>
              </a>
              <Link to="/reservations">
                <span><Clock3 size={21} /></span>
                <div><small>Đặt bàn</small><strong>Gửi yêu cầu trực tuyến</strong></div>
              </Link>
            </div>
          </div>

          <div className="home-contact-card">
            <span className="home-contact-card-icon"><CalendarCheck2 size={30} /></span>
            <small>LUMORA RESTAURANT</small>
            <h3>Đặt chỗ cho buổi gặp gỡ tiếp theo</h3>
            <p>Hoàn tất thông tin trong vài bước để nhà hàng tiếp nhận yêu cầu của bạn.</p>
            <Link to="/reservations">
              Bắt đầu đặt bàn <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-main">
            <div className="home-footer-brand">
              <a className="home-brand" href="#top" onClick={scrollTo('top')}>
                <span className="home-brand-mark"><UtensilsCrossed size={23} /></span>
                <span className="home-brand-copy">
                  <strong>LUMORA</strong>
                  <small>Nhà hàng &amp; Ẩm thực</small>
                </span>
              </a>
              <p>Nơi hương vị và những khoảnh khắc đáng nhớ gặp nhau.</p>
            </div>

            <div className="home-footer-links">
              <strong>Khám phá</strong>
              <a href="#menu" onClick={scrollTo('menu')}>Thực đơn</a>
              <a href="#about" onClick={scrollTo('about')}>Giới thiệu</a>
              <a href="#offers" onClick={scrollTo('offers')}>Ưu đãi</a>
            </div>

            <div className="home-footer-links">
              <strong>Hỗ trợ</strong>
              <Link to="/reservations">Đặt bàn</Link>
              <a href="#contact" onClick={scrollTo('contact')}>Liên hệ</a>
            <Link to="/delivery">Giao tận nơi</Link>
              <Link to="/login">Đăng nhập nhân viên</Link>
            </div>

            <div className="home-footer-contact">
              <strong>Liên hệ</strong>
              <span><MapPin size={16} /> {RESTAURANT.address}</span>
              <a href={`tel:${RESTAURANT.phone.replace(/\s/g, '')}`}><Phone size={16} /> {RESTAURANT.phone}</a>
            </div>
          </div>

          <div className="home-footer-bottom">
            <p>© {new Date().getFullYear()} LUMORA. Tất cả quyền được bảo lưu.</p>
            <a href="#top" onClick={scrollTo('top')}>Về đầu trang <ArrowRight size={14} /></a>
          </div>
        </div>
      </footer>
      <LumoraChatbot />
    </main>
  );
}
