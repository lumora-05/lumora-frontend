import { useEffect, useState } from 'react';
import {
  Bike,
  ChefHat,
  Clock,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Menu,
  MousePointerClick,
  Phone,
  Plus,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { menuApi } from '../api/menuApi';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { imageUrl } from '../utils/imageUrl';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { localizedFoodDescription, localizedFoodName } from '../utils/localizedContent';
import '../styles/home.css';

const DEFAULT_SETTINGS = {
  restaurantName: 'LUMORA',
  address: '128 Nguyễn Huệ, Quận 1, TP.HCM',
  phone: '(028) 3822 1234',
  email: 'xinchao@lumora.vn',
  openingHours: '10:00 - 22:00 hằng ngày',
  reservationUrl: '/reservations',
  menuUrl: '/menu',
  logoUrl: '',
  bannerUrl: '',
};

const navLinks = [
  { label: 'Trang chủ', href: '#trang-chu' },
  { label: 'Thực đơn', href: '/menu' },
  { label: 'Về chúng tôi', href: '#gioi-thieu' },
  { label: 'Đặt bàn', href: '/reservations' },
  { label: 'Liên hệ', href: '#lien-he' },
];

const DEFAULT_DISHES = [
  {
    name: 'Bò lúc lắc',
    nameEn: 'Shaking beef',
    desc: 'Thăn bò áp chảo cùng ớt chuông, hành tây và sốt tiêu đen đậm đà.',
    descEn: 'Seared beef tenderloin with bell peppers, onion, and rich black pepper sauce.',
    price: '185.000đ',
    img: '/dish-bo-luc-lac.png',
    tag: 'Bán chạy',
    tagEn: 'Best seller',
  },
  {
    name: 'Cá hồi áp chảo',
    nameEn: 'Pan-seared salmon',
    desc: 'Cá hồi Na Uy áp chảo giòn da, sốt bơ chanh và rau mầm tươi.',
    descEn: 'Crispy-skin Norwegian salmon with lemon butter sauce and fresh microgreens.',
    price: '245.000đ',
    img: '/dish-ca-hoi.png',
    tag: 'Đặc sắc',
    tagEn: 'Signature',
  },
  {
    name: 'Salad vườn xanh',
    nameEn: 'Garden green salad',
    desc: 'Rau hữu cơ, bơ, cà chua bi và hạt óc chó cùng sốt dầu giấm.',
    descEn: 'Organic greens, avocado, cherry tomatoes, and walnuts with vinaigrette.',
    price: '95.000đ',
    img: '/dish-salad.png',
    tag: 'Healthy',
  },
  {
    name: 'Bánh lava socola',
    nameEn: 'Chocolate lava cake',
    desc: 'Bánh socola tan chảy nóng hổi kèm kem vani và trái mọng.',
    descEn: 'Warm molten chocolate cake served with vanilla ice cream and berries.',
    price: '78.000đ',
    img: '/dish-dessert.png',
    tag: 'Tráng miệng',
    tagEn: 'Dessert',
  },
];

const highlights = [
  {
    icon: Leaf,
    title: 'Nguyên liệu tươi mỗi ngày',
    desc: 'Rau củ và hải sản được tuyển chọn từ các nông trại và cảng cá uy tín mỗi sáng.',
  },
  {
    icon: ChefHat,
    title: 'Đầu bếp tận tâm',
    desc: 'Đội ngũ bếp trưởng với hơn 10 năm kinh nghiệm tại các nhà hàng danh tiếng.',
  },
  {
    icon: Heart,
    title: 'Trải nghiệm trọn vẹn',
    desc: 'Không gian ấm cúng cùng dịch vụ chu đáo cho từng khoảnh khắc của bạn.',
  },
];

const steps = [
  {
    icon: MousePointerClick,
    step: '01',
    title: 'Chọn món yêu thích',
    desc: 'Duyệt thực đơn và thêm những món bạn muốn vào giỏ chỉ trong vài giây.',
  },
  {
    icon: UtensilsCrossed,
    step: '02',
    title: 'Xác nhận đơn hàng',
    desc: 'Chọn ăn tại nhà hàng hoặc giao tận nơi, rồi xác nhận đặt món.',
  },
  {
    icon: Bike,
    step: '03',
    title: 'Thưởng thức',
    desc: 'Món ăn được chuẩn bị nóng hổi và phục vụ nhanh chóng đến bạn.',
  },
];

function Brand({ settings }) {
  const logo = imageUrl(settings.logoUrl);
  return (
    <>
      {logo ? (
        <span className="v0-brand-logo-image"><img src={logo} alt={`Logo ${settings.restaurantName}`} /></span>
      ) : (
        <span className="v0-brand-mark">{(settings.restaurantName || 'L').trim().charAt(0).toUpperCase()}</span>
      )}
    </>
  );
}

function Navbar({ settings }) {
  const [open, setOpen] = useState(false);
  const reservationUrl = settings.reservationUrl || '/reservations';

  return (
    <header className="v0-navbar">
      <div className="v0-shell v0-navbar-inner">
        <a href="#trang-chu" className="v0-brand"><Brand settings={settings} /></a>

        <nav className="v0-nav-desktop">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="v0-book-desktop">
          <LanguageSwitcher compact />
          <a href="/login" className="v0-button v0-button-outline v0-pill">Đăng nhập</a>
          <a href={reservationUrl} className="v0-button v0-button-primary v0-pill">Đặt bàn ngay</a>
        </div>

        <button
          type="button"
          className="v0-menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Mở menu"
          aria-expanded={open}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="v0-mobile-panel">
          <nav className="v0-shell v0-mobile-nav">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
            ))}
            <LanguageSwitcher />
            <a href="/login" className="v0-button v0-button-outline v0-pill v0-mobile-login" onClick={() => setOpen(false)}>Đăng nhập</a>
            <a href={reservationUrl} className="v0-button v0-button-primary v0-pill v0-mobile-book" onClick={() => setOpen(false)}>Đặt bàn ngay</a>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero({ settings }) {
  const banner = imageUrl(settings.bannerUrl) || '/lunora-hero.png';
  const configuredMenuUrl = String(settings.menuUrl || '').trim();
  const menuUrl = !configuredMenuUrl || configuredMenuUrl === '/#menu' || configuredMenuUrl === '/delivery' || configuredMenuUrl.startsWith('#')
    ? '/menu'
    : configuredMenuUrl;

  return (
    <section id="trang-chu" className="v0-hero">
      <div className="v0-hero-bg" aria-hidden="true">
        <img src={banner} alt="" />
        <div className="v0-hero-overlay" />
      </div>

      <div className="v0-shell v0-hero-content">
        <span className="v0-hero-badge">Trải nghiệm ẩm thực tinh tế</span>

        <h1 className="v0-serif">Hương vị đánh thức mọi giác quan tại {settings.restaurantName}</h1>

        <p>
          Nơi những nguyên liệu tươi ngon được chế biến bởi đội ngũ đầu bếp tận tâm. Đặt bàn hoặc khám phá thực đơn
          chỉ trong vài chạm.
        </p>

        <div className="v0-hero-actions">
          <a href={settings.reservationUrl || '/reservations'} className="v0-button v0-button-primary v0-button-lg v0-pill">Đặt bàn ngay</a>
          <a href="/menu" className="v0-button v0-button-hero-outline v0-button-lg v0-pill">Xem thực đơn</a>
        </div>

        <div className="v0-hero-meta">
          {settings.openingHours && <span><Clock size={16} /> Mở cửa {settings.openingHours}</span>}
          {settings.address && <span><MapPin size={16} /> {settings.address}</span>}
        </div>
      </div>
    </section>
  );
}

function FeaturedMenu({ restaurantName }) {
  const { language } = useLanguage();
  const [dishes, setDishes] = useState(DEFAULT_DISHES);

  useEffect(() => {
    let active = true;

    menuApi.getTopSelling(4, { skipAuth: true })
      .then((response) => {
        if (!active) return;
        const foods = Array.isArray(response?.data) ? response.data : [];
        if (foods.length === 0) return;

        setDishes(foods.map((food) => ({
          name: localizedFoodName(food, language, 'Món ăn'),
          desc: localizedFoodDescription(food, language, language === 'en' ? 'A dish from our restaurant menu.' : 'Món ăn trong thực đơn nhà hàng'),
          price: `${new Intl.NumberFormat('vi-VN').format(Number(food.gia || 0))}đ`,
          img: imageUrl(food.hinhAnh) || '/dish-bo-luc-lac.png',
          tag: language === 'en' ? 'Best seller' : 'Bán chạy',
        })));
      })
      .catch(() => {
        // Giữ bộ món mặc định nếu backend tạm thời không phản hồi.
      });

    return () => { active = false; };
  }, [language]);

  return (
    <section id="thuc-don" className="v0-shell v0-section v0-menu-section">
      <div className="v0-section-head">
        <span className="v0-eyebrow">Thực đơn</span>
        <h2 className="v0-serif">Những món ăn bán chạy nhất</h2>
        <p>
          Những món được thực khách lựa chọn nhiều nhất tại {restaurantName}.
        </p>
      </div>

      <div className="v0-dish-grid">
        {dishes.map((dish) => (
          <article key={dish.name} className="v0-dish-card">
            <div className="v0-dish-image-wrap">
              <img src={dish.img} alt={language === 'en' ? (dish.nameEn || dish.name) : dish.name} />
              <span className="v0-dish-tag">{language === 'en' ? (dish.tagEn || dish.tag) : dish.tag}</span>
            </div>
            <div className="v0-dish-body">
              <h3 className="v0-serif">{language === 'en' ? (dish.nameEn || dish.name) : dish.name}</h3>
              <p>{language === 'en' ? (dish.descEn || dish.desc) : dish.desc}</p>
              <div className="v0-dish-bottom">
                <span className="v0-serif v0-price">{dish.price}</span>
                <button type="button" className="v0-button v0-button-primary v0-dish-add v0-pill">
                  <Plus size={16} />
                  Thêm
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="v0-menu-more">
        <a href="/menu" className="v0-button v0-button-outline v0-button-lg v0-pill">Xem toàn bộ thực đơn</a>
      </div>
    </section>
  );
}

function About({ restaurantName }) {
  return (
    <section id="gioi-thieu" className="v0-about-bg">
      <div className="v0-shell v0-section v0-about-grid">
        <div>
          <span className="v0-eyebrow">Về {restaurantName}</span>
          <h2 className="v0-serif v0-about-title">Trải nghiệm ẩm thực hiện đại và tiện lợi</h2>
          <p className="v0-about-copy">
            {restaurantName} hướng đến việc mang đến cho thực khách trải nghiệm ẩm thực chất lượng trong không gian hiện đại
            và thân thiện. Thực đơn được xây dựng đa dạng, phù hợp với nhiều nhu cầu và sở thích của khách hàng.
          </p>
          <p className="v0-about-copy v0-about-copy-second">
            Bên cạnh chất lượng món ăn, {restaurantName} chú trọng ứng dụng công nghệ vào quá trình phục vụ. Khách hàng có thể
            xem thực đơn, đặt bàn, đặt món trực tuyến hoặc quét mã QR tại bàn để gọi món nhanh chóng và thuận tiện.
          </p>

          <div className="v0-stats">
            <div><strong className="v0-serif">Phục vụ</strong><span>chuyên nghiệp</span></div>
            <div><strong className="v0-serif">Thực đơn</strong><span>đa dạng</span></div>
            <div><strong className="v0-serif">Trải nghiệm</strong><span>tiện lợi</span></div>
          </div>
        </div>

        <div className="v0-highlight-list">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="v0-highlight-card">
                <span className="v0-highlight-icon"><Icon size={24} /></span>
                <div>
                  <h3 className="v0-serif">{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OrderCta({ settings }) {
  return (
    <section id="dat-mon" className="v0-shell v0-section v0-order-section">
      <div className="v0-section-head">
        <span className="v0-eyebrow">Đặt món dễ dàng</span>
        <h2 className="v0-serif">Chỉ 3 bước để có bữa ăn ngon</h2>
      </div>

      <div className="v0-step-grid">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.step} className="v0-step-card">
              <span className="v0-step-icon"><Icon size={28} /></span>
              <span className="v0-serif v0-step-no">{item.step}</span>
              <h3 className="v0-serif">{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="v0-dark-cta">
        <h3 className="v0-serif">Sẵn sàng thưởng thức cùng {settings.restaurantName}?</h3>
        <p>Đặt bàn trước để giữ chỗ cho những dịp đặc biệt, hoặc gọi món trực tuyến để nhận ngay tại nhà.</p>
        <div className="v0-dark-actions">
          <a href={settings.reservationUrl || '/reservations'} className="v0-button v0-button-primary v0-button-lg v0-pill">Đặt bàn ngay</a>
          <a href="/menu" className="v0-button v0-button-dark-outline v0-button-lg v0-pill">Gọi món giao tận nơi</a>
        </div>
      </div>
    </section>
  );
}

function ContactSection({ settings }) {
  const mapUrl = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : 'https://www.google.com/maps';
  const mapEmbedUrl = settings.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed`
    : 'https://www.google.com/maps?q=Vietnam&output=embed';

  return (
    <section id="lien-he" className="v0-contact-section">
      <div className="v0-shell v0-contact-inner">
        <div className="v0-section-head v0-contact-head">
          <span className="v0-eyebrow">Liên hệ với chúng tôi</span>
          <h2 className="v0-serif">Thông tin liên hệ</h2>
          <p>Liên hệ với {settings.restaurantName} khi bạn cần hỗ trợ hoặc muốn biết thêm thông tin trước khi ghé nhà hàng.</p>
        </div>

        <div className="v0-contact-grid">
          <div className="v0-contact-cards">
            {settings.address && (
              <div className="v0-contact-card v0-contact-card-wide">
                <span className="v0-contact-icon"><MapPin size={22} /></span>
                <div>
                  <h3>Địa chỉ</h3>
                  <p>{settings.address}</p>
                </div>
              </div>
            )}

            {settings.phone && (
              <a className="v0-contact-card" href={`tel:${String(settings.phone).replace(/\s+/g, '')}`}>
                <span className="v0-contact-icon"><Phone size={22} /></span>
                <div>
                  <h3>Số điện thoại</h3>
                  <p>{settings.phone}</p>
                </div>
              </a>
            )}

            {settings.email && (
              <a className="v0-contact-card" href={`mailto:${settings.email}`}>
                <span className="v0-contact-icon"><Mail size={22} /></span>
                <div>
                  <h3>Email</h3>
                  <p>{settings.email}</p>
                </div>
              </a>
            )}

            {settings.openingHours && (
              <div className="v0-contact-card">
                <span className="v0-contact-icon"><Clock size={22} /></span>
                <div>
                  <h3>Giờ mở cửa</h3>
                  <p>{settings.openingHours}</p>
                </div>
              </div>
            )}
          </div>

          <div className="v0-contact-location">
            <div className="v0-contact-map">
              <iframe
                src={mapEmbedUrl}
                title={`Bản đồ ${settings.restaurantName}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <div className="v0-contact-map-info">
              <span className="v0-contact-location-icon"><MapPin size={24} /></span>
              <div className="v0-contact-map-copy">
                <span className="v0-eyebrow">Vị trí nhà hàng</span>
                <h3 className="v0-serif">Ghé thăm {settings.restaurantName}</h3>
                <p>{settings.address || 'Thông tin địa chỉ đang được cập nhật.'}</p>
              </div>
              <a className="v0-button v0-button-primary v0-pill" href={mapUrl} target="_blank" rel="noreferrer">
                Xem trên bản đồ
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ settings }) {
  return (
    <footer className="v0-footer">
      <div className="v0-shell v0-footer-inner">
        <div className="v0-footer-grid">
          <div>
            <div className="v0-brand"><Brand settings={settings} /></div>
            <p className="v0-footer-brand-copy">Ẩm thực tinh tế, phục vụ tận tâm. Nơi mỗi bữa ăn trở thành kỷ niệm đáng nhớ.</p>
          </div>

          <div>
            <h4 className="v0-serif">Khám phá</h4>
            <ul>
              <li><a href="/menu">Thực đơn</a></li>
              <li><a href="#gioi-thieu">Về chúng tôi</a></li>
              <li><a href="#dat-mon">Đặt món</a></li>
            </ul>
          </div>

          <div>
            <h4 className="v0-serif">Liên hệ</h4>
            <ul>
              {settings.phone && <li><Phone size={16} /> {settings.phone}</li>}
              {settings.email && <li><Mail size={16} /> {settings.email}</li>}
              {settings.address && <li className="v0-footer-address"><MapPin size={16} /> <span>{settings.address}</span></li>}
            </ul>
          </div>

          <div>
            <h4 className="v0-serif">Giờ mở cửa</h4>
            <ul>
              {settings.openingHours && <li><Clock size={16} /> {settings.openingHours}</li>}
            </ul>
          </div>
        </div>

        <div className="v0-footer-bottom">© 2026 {settings.restaurantName}. Tất cả quyền được bảo lưu.</div>
      </div>
    </footer>
  );
}

export default function Home() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        setSettings((current) => ({ ...current, ...(data || {}) }));
      })
      .catch(() => {
        // Trang chủ vẫn dùng dữ liệu mặc định nếu backend tạm thời không phản hồi.
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="v0-home">
      <Navbar settings={settings} />
      <Hero settings={settings} />
      <FeaturedMenu restaurantName={settings.restaurantName} />
      <About restaurantName={settings.restaurantName} />
      <OrderCta settings={settings} />
      <ContactSection settings={settings} />
      <Footer settings={settings} />
    </main>
  );
}