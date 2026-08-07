import { useState } from 'react';
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
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import '../styles/home.css';

const navLinks = [
  { label: 'Trang chủ', href: '#trang-chu' },
  { label: 'Thực đơn', href: '#thuc-don' },
  { label: 'Về chúng tôi', href: '#gioi-thieu' },
  { label: 'Đặt món', href: '#dat-mon' },
  { label: 'Liên hệ', href: '#lien-he' },
];

const dishes = [
  {
    name: 'Bò lúc lắc',
    desc: 'Thăn bò áp chảo cùng ớt chuông, hành tây và sốt tiêu đen đậm đà.',
    price: '185.000đ',
    img: '/dish-bo-luc-lac.png',
    tag: 'Bán chạy',
  },
  {
    name: 'Cá hồi áp chảo',
    desc: 'Cá hồi Na Uy áp chảo giòn da, sốt bơ chanh và rau mầm tươi.',
    price: '245.000đ',
    img: '/dish-ca-hoi.png',
    tag: 'Đặc sắc',
  },
  {
    name: 'Salad vườn xanh',
    desc: 'Rau hữu cơ, bơ, cà chua bi và hạt óc chó cùng sốt dầu giấm.',
    price: '95.000đ',
    img: '/dish-salad.png',
    tag: 'Healthy',
  },
  {
    name: 'Bánh lava socola',
    desc: 'Bánh socola tan chảy nóng hổi kèm kem vani và trái mọng.',
    price: '78.000đ',
    img: '/dish-dessert.png',
    tag: 'Tráng miệng',
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

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="v0-navbar">
      <div className="v0-shell v0-navbar-inner">
        <a href="#trang-chu" className="v0-brand">
          <span className="v0-brand-mark">L</span>
          <span className="v0-serif v0-brand-name">Lunora</span>
        </a>

        <nav className="v0-nav-desktop">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="v0-book-desktop">
          <button type="button" className="v0-button v0-button-primary v0-pill">Đặt bàn ngay</button>
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
            <button type="button" className="v0-button v0-button-primary v0-pill v0-mobile-book">Đặt bàn ngay</button>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="trang-chu" className="v0-hero">
      <div className="v0-hero-bg" aria-hidden="true">
        <img src="/lunora-hero.png" alt="" />
        <div className="v0-hero-overlay" />
      </div>

      <div className="v0-shell v0-hero-content">
        <span className="v0-hero-badge">
          <Star size={14} fill="currentColor" />
          Ẩm thực tinh tế từ 2015
        </span>

        <h1 className="v0-serif">Hương vị đánh thức mọi giác quan tại Lunora</h1>

        <p>
          Nơi những nguyên liệu tươi ngon nhất được chế biến bởi đội ngũ đầu bếp tận tâm. Đặt bàn hoặc gọi món trực
          tuyến chỉ trong vài chạm.
        </p>

        <div className="v0-hero-actions">
          <a href="#dat-mon" className="v0-button v0-button-primary v0-button-lg v0-pill">Đặt món ngay</a>
          <a href="#thuc-don" className="v0-button v0-button-hero-outline v0-button-lg v0-pill">Xem thực đơn</a>
        </div>

        <div className="v0-hero-meta">
          <span><Clock size={16} /> Mở cửa 10:00 - 22:00 hằng ngày</span>
          <span><MapPin size={16} /> 128 Nguyễn Huệ, Quận 1, TP.HCM</span>
        </div>
      </div>
    </section>
  );
}

function FeaturedMenu() {
  return (
    <section id="thuc-don" className="v0-shell v0-section v0-menu-section">
      <div className="v0-section-head">
        <span className="v0-eyebrow">Thực đơn</span>
        <h2 className="v0-serif">Những món ăn được yêu thích nhất</h2>
        <p>
          Tuyển chọn từ căn bếp Lunora — mỗi món là sự kết hợp giữa nguyên liệu tươi và bàn tay khéo léo của đầu bếp.
        </p>
      </div>

      <div className="v0-dish-grid">
        {dishes.map((dish) => (
          <article key={dish.name} className="v0-dish-card">
            <div className="v0-dish-image-wrap">
              <img src={dish.img} alt={dish.name} />
              <span className="v0-dish-tag">{dish.tag}</span>
            </div>
            <div className="v0-dish-body">
              <h3 className="v0-serif">{dish.name}</h3>
              <p>{dish.desc}</p>
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
        <a href="#dat-mon" className="v0-button v0-button-outline v0-button-lg v0-pill">Xem toàn bộ thực đơn</a>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="gioi-thieu" className="v0-about-bg">
      <div className="v0-shell v0-section v0-about-grid">
        <div>
          <span className="v0-eyebrow">Về Lunora</span>
          <h2 className="v0-serif v0-about-title">Câu chuyện về hương vị và sự tận tâm</h2>
          <p className="v0-about-copy">
            Ra đời năm 2015, Lunora bắt đầu từ mong muốn mang đến những bữa ăn không chỉ ngon miệng mà còn chạm đến
            cảm xúc. Chúng tôi tin rằng mỗi món ăn là một câu chuyện, được kể qua nguyên liệu tinh tế và sự chăm chút
            trong từng chi tiết.
          </p>
          <p className="v0-about-copy v0-about-copy-second">
            Đến nay, Lunora tự hào phục vụ hơn 50.000 lượt khách mỗi năm, trở thành điểm hẹn quen thuộc cho những bữa
            tối đáng nhớ.
          </p>

          <div className="v0-stats">
            <div><strong className="v0-serif">9+</strong><span>Năm phục vụ</span></div>
            <div><strong className="v0-serif">120+</strong><span>Món trong thực đơn</span></div>
            <div><strong className="v0-serif">4.9★</strong><span>Đánh giá trung bình</span></div>
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

function OrderCta() {
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
        <h3 className="v0-serif">Sẵn sàng thưởng thức cùng Lunora?</h3>
        <p>Đặt bàn trước để giữ chỗ cho những dịp đặc biệt, hoặc gọi món trực tuyến để nhận ngay tại nhà.</p>
        <div className="v0-dark-actions">
          <button type="button" className="v0-button v0-button-primary v0-button-lg v0-pill">Đặt bàn ngay</button>
          <button type="button" className="v0-button v0-button-dark-outline v0-button-lg v0-pill">Gọi món giao tận nơi</button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="lien-he" className="v0-footer">
      <div className="v0-shell v0-footer-inner">
        <div className="v0-footer-grid">
          <div>
            <div className="v0-brand">
              <span className="v0-brand-mark">L</span>
              <span className="v0-serif v0-brand-name">Lunora</span>
            </div>
            <p className="v0-footer-brand-copy">Ẩm thực tinh tế, phục vụ tận tâm. Nơi mỗi bữa ăn trở thành kỷ niệm đáng nhớ.</p>
          </div>

          <div>
            <h4 className="v0-serif">Khám phá</h4>
            <ul>
              <li><a href="#thuc-don">Thực đơn</a></li>
              <li><a href="#gioi-thieu">Về chúng tôi</a></li>
              <li><a href="#dat-mon">Đặt món</a></li>
            </ul>
          </div>

          <div>
            <h4 className="v0-serif">Liên hệ</h4>
            <ul>
              <li><Phone size={16} /> (028) 3822 1234</li>
              <li><Mail size={16} /> xinchao@lunora.vn</li>
              <li className="v0-footer-address"><MapPin size={16} /> <span>128 Nguyễn Huệ, Quận 1, TP.HCM</span></li>
            </ul>
          </div>

          <div>
            <h4 className="v0-serif">Giờ mở cửa</h4>
            <ul>
              <li><Clock size={16} /> Thứ 2 - Thứ 6: 10:00 - 22:00</li>
              <li className="v0-footer-indent">Thứ 7 - CN: 09:00 - 23:00</li>
            </ul>
          </div>
        </div>

        <div className="v0-footer-bottom">© 2026 Lunora. Đồ án tốt nghiệp — Ứng dụng quản lý đơn hàng nhà hàng.</div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="v0-home">
      <Navbar />
      <Hero />
      <FeaturedMenu />
      <About />
      <OrderCta />
      <Footer />
    </main>
  );
}
