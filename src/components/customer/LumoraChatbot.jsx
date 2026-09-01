import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCcw,
  Send,
  ShoppingCart,
  Sparkles,
  Tag,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatbotApi } from '../../api/chatbotApi';
import { useCart } from '../../context/CartContext';
import { errorMessageOf, useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';

const DEFAULT_QUICK_REPLIES = [
  'Gợi ý món cho tôi',
  'Có món nào dưới 200.000đ?',
  'Ưu đãi hiện tại',
  'Nhà hàng mở cửa lúc nào?',
  'Tôi muốn đặt bàn',
];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: 'Xin chào! Tôi là trợ lý LUMORA. Tôi có thể giúp bạn tìm món, xem ưu đãi, đặt bàn hoặc kiểm tra đơn hàng tại bàn.',
};

const RESTAURANT_PHONE = String(import.meta.env.VITE_RESTAURANT_PHONE || '0979792909')
  .replace(/[^+\d]/g, '');

function safeInternalPath(value, fallback = '/') {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path : fallback;
}

function safeTelephoneUrl(value) {
  const url = String(value || '').trim();
  if (/^tel:\+?[0-9*#(). -]+$/i.test(url)) return url;
  return RESTAURANT_PHONE ? `tel:${RESTAURANT_PHONE}` : '';
}

function scopeName(qrToken) {
  return qrToken ? `table_${qrToken}` : 'public';
}

function storageKey(type, qrToken) {
  return `lumora_chatbot_${type}_${scopeName(qrToken)}`;
}

function readStoredMessages(qrToken) {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey('messages', qrToken)) || '[]');
    return Array.isArray(value) && value.length ? value : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function readSessionId(qrToken) {
  try {
    return sessionStorage.getItem(storageKey('session', qrToken)) || '';
  } catch {
    return '';
  }
}

function unwrapData(response) {
  return response?.data ?? response;
}

function toMessage(data) {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: 'assistant',
    text: data?.message || 'Tôi chưa thể trả lời câu hỏi này lúc này.',
    intent: data?.intent || 'UNKNOWN',
    foods: Array.isArray(data?.foods) ? data.foods : [],
    promotions: Array.isArray(data?.promotions) ? data.promotions : [],
    order: data?.order || null,
    actions: Array.isArray(data?.actions) ? data.actions : [],
    disclaimer: data?.disclaimer || '',
  };
}

function normalizeFood(food) {
  return {
    maMonAn: food?.id,
    id: food?.id,
    tenMonAn: food?.name,
    name: food?.name,
    gia: Number(food?.price || 0),
    price: Number(food?.price || 0),
    moTa: food?.description || '',
    description: food?.description || '',
    hinhAnh: food?.imageUrl || '',
    imageUrl: food?.imageUrl || '',
    trangThai: food?.available !== false,
    available: food?.available !== false,
  };
}

function discountText(promotion) {
  const value = Number(promotion?.discountValue || 0);
  const type = String(promotion?.discountType || '').toUpperCase();
  if (!value) return 'Ưu đãi đang áp dụng';
  if (type.includes('PERCENT')) return `Giảm ${value}%`;
  return `Giảm ${formatMoney(value)}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function FoodCard({ food, qrToken, cart, onNavigate }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [added, setAdded] = useState(false);
  const toast = useToast();
  const src = food?.imageUrl ? imageUrl(food.imageUrl) : '';
  const available = food?.available !== false;

  function addToCart() {
    if (!cart || !available) return;
    cart.add(normalizeFood(food));
    setAdded(true);
    toast.success(`Đã thêm ${food?.name || 'món ăn'} vào giỏ hàng.`);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="lumora-chatbot-food-card">
      <button
        type="button"
        className="lumora-chatbot-food-image"
        onClick={() => onNavigate(food)}
        aria-label={`Xem ${food?.name || 'món ăn'}`}
      >
        {src && !imageFailed ? (
          <img src={src} alt={food?.name || 'Món ăn LUMORA'} onError={() => setImageFailed(true)} />
        ) : (
          <span aria-hidden="true"><UtensilsCrossed size={24} /></span>
        )}
      </button>
      <div className="lumora-chatbot-food-info">
        <small>{food?.category || 'Món ăn'}</small>
        <strong>{food?.name || 'Món ăn LUMORA'}</strong>
        <div>
          <b>{formatMoney(food?.price)}</b>
          <span className={available ? 'available' : 'unavailable'}>{available ? 'Còn món' : 'Tạm hết'}</span>
        </div>
        {qrToken && cart ? (
          <button type="button" className="lumora-chatbot-add" onClick={addToCart} disabled={!available}>
            <ShoppingCart size={14} />
            {added ? 'Đã thêm' : 'Thêm vào giỏ'}
          </button>
        ) : (
          <button type="button" className="lumora-chatbot-view" onClick={() => onNavigate(food)}>
            Xem thực đơn <ChevronRight size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

function PromotionCard({ promotion }) {
  return (
    <article className="lumora-chatbot-promotion-card">
      <span><Tag size={18} /></span>
      <div>
        <small>{promotion?.code || 'ƯU ĐÃI'}</small>
        <strong>{promotion?.name || 'Chương trình ưu đãi'}</strong>
        <p>{promotion?.description || discountText(promotion)}</p>
        <div>
          <b>{discountText(promotion)}</b>
          {promotion?.endDate ? <em>Đến {formatDate(promotion.endDate)}</em> : null}
        </div>
      </div>
    </article>
  );
}

function OrderCard({ order }) {
  return (
    <article className="lumora-chatbot-order-card">
      <header>
        <span><Clock3 size={17} /></span>
        <div>
          <small>Đơn hàng #{order?.orderId}</small>
          <strong>{order?.statusLabel || order?.status || 'Đang xử lý'}</strong>
        </div>
      </header>
      <div>
        <span>{Number(order?.itemCount || 0)} món</span>
        <b>{formatMoney(order?.total)}</b>
      </div>
    </article>
  );
}

export default function LumoraChatbot({ qrToken = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => readStoredMessages(qrToken));
  const [sessionId, setSessionId] = useState(() => readSessionId(qrToken));
  const [quickReplies, setQuickReplies] = useState(DEFAULT_QUICK_REPLIES);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const tableContext = Boolean(qrToken);
  const visibleQuickReplies = useMemo(() => quickReplies.slice(0, 5), [quickReplies]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey('messages', qrToken), JSON.stringify(messages.slice(-20)));
    } catch {
      // Chatbot vẫn hoạt động khi trình duyệt chặn sessionStorage.
    }
  }, [messages, qrToken]);

  useEffect(() => {
    if (!sessionId) return;
    try {
      sessionStorage.setItem(storageKey('session', qrToken), sessionId);
    } catch {
      // Không ảnh hưởng phiên trò chuyện hiện tại.
    }
  }, [qrToken, sessionId]);

  useEffect(() => {
    if (!open) return;
    setHasUnread(false);
    chatbotApi.getQuickReplies()
      .then((response) => {
        const data = unwrapData(response);
        if (Array.isArray(data) && data.length) setQuickReplies(data);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open, sending]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  async function sendMessage(textValue) {
    const text = String(textValue ?? input).trim();
    if (!text || sending) return;

    const userMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user',
      text,
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const response = await chatbotApi.sendMessage({
        message: text,
        sessionId: sessionId || null,
        qrToken: qrToken || null,
      });
      const data = unwrapData(response);
      if (data?.sessionId) setSessionId(data.sessionId);
      if (Array.isArray(data?.quickReplies) && data.quickReplies.length) setQuickReplies(data.quickReplies);
      setMessages((current) => [...current, toMessage(data)]);
      if (!open) setHasUnread(true);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: errorMessageOf(error, 'Chatbot chưa thể kết nối với hệ thống. Vui lòng thử lại sau.'),
          error: true,
          retryText: text,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function navigateToMenu() {
    if (qrToken) {
      navigate(`/table/${qrToken}`);
      setOpen(false);
      return;
    }
    if (location.pathname === '/') {
      document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/menu');
      window.setTimeout(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
    setOpen(false);
  }

  function navigateToFood(food) {
    if (qrToken && food?.id != null) {
      navigate(`/table/${qrToken}/foods/${food.id}`);
      setOpen(false);
      return;
    }
    navigateToMenu();
  }

  function appendAssistantNotice(text) {
    setMessages((current) => [
      ...current,
      {
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'assistant',
        text,
        intent: 'GUIDANCE',
      },
    ]);
  }

  function handleAction(action) {
    const type = String(action?.action || '').toUpperCase();

    if (type === 'OPEN_MENU') return navigateToMenu();

    if (type === 'OPEN_RESERVATION') {
      navigate(safeInternalPath(action?.url, '/reservations'));
      setOpen(false);
      return;
    }

    if (type === 'CALL_RESTAURANT') {
      const telephoneUrl = safeTelephoneUrl(action?.url);
      if (telephoneUrl) window.location.href = telephoneUrl;
      return;
    }

    if (type === 'OPEN_CURRENT_ORDER') {
      if (qrToken) {
        navigate(`/table/${qrToken}/orders`);
        setOpen(false);
      } else {
        appendAssistantNotice('Vui lòng quét mã QR đặt tại bàn để xem đơn hàng hiện tại.');
      }
      return;
    }

    if (type === 'OPEN_SERVICE_REQUEST') {
      if (qrToken) {
        window.dispatchEvent(new CustomEvent('lumora:open-service-request'));
        setOpen(false);
      } else {
        const telephoneUrl = safeTelephoneUrl(action?.url);
        if (telephoneUrl) window.location.href = telephoneUrl;
        else appendAssistantNotice('Chức năng gọi phục vụ chỉ khả dụng sau khi quét mã QR tại bàn.');
      }
      return;
    }

    if (type === 'REQUIRE_TABLE_QR') {
      appendAssistantNotice(
        'Hãy mở Camera hoặc Zalo và quét mã QR đặt trên bàn. Sau khi trang của bàn mở ra, bạn có thể kiểm tra đơn hàng, gọi phục vụ và yêu cầu thanh toán.'
      );
      window.setTimeout(() => inputRef.current?.focus(), 80);
      return;
    }

    appendAssistantNotice('Hành động này chưa được hỗ trợ trên giao diện hiện tại. Vui lòng hỏi lại hoặc liên hệ nhà hàng.');
  }

  function retryMessage(message) {
    if (!message?.retryText || sending) return;
    setMessages((current) => current.filter((item) => item.id !== message.id));
    sendMessage(message.retryText);
  }

  function resetConversation() {
    setMessages([WELCOME_MESSAGE]);
    setSessionId('');
    setQuickReplies(DEFAULT_QUICK_REPLIES);
    try {
      sessionStorage.removeItem(storageKey('messages', qrToken));
      sessionStorage.removeItem(storageKey('session', qrToken));
    } catch {
      // Không ảnh hưởng giao diện.
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  const content = (
    <div className={`lumora-chatbot-root ${tableContext ? 'table-context' : 'public-context'}`}>
      {open ? (
        <section className="lumora-chatbot-panel" role="dialog" aria-label="LUMORA Assistant" aria-modal="false">
          <header className="lumora-chatbot-header">
            <div className="lumora-chatbot-identity">
              <span><Bot size={22} /></span>
              <div>
                <strong>LUMORA Assistant</strong>
                <small><i /> Trợ lý AI nhà hàng trực tuyến</small>
              </div>
            </div>
            <div className="lumora-chatbot-header-actions">
              <button type="button" onClick={resetConversation} aria-label="Bắt đầu cuộc trò chuyện mới" title="Cuộc trò chuyện mới">
                <Sparkles size={17} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng chatbot">
                <X size={19} />
              </button>
            </div>
          </header>

          <div className="lumora-chatbot-messages" ref={listRef} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`lumora-chatbot-message ${message.role} ${message.error ? 'error' : ''}`}>
                {message.role === 'assistant' ? <span className="lumora-chatbot-avatar"><Bot size={16} /></span> : null}
                <div className="lumora-chatbot-bubble-wrap">
                  <div className="lumora-chatbot-bubble">{message.text}</div>

                  {message.error && message.retryText ? (
                    <button
                      type="button"
                      className="lumora-chatbot-retry"
                      onClick={() => retryMessage(message)}
                      disabled={sending}
                    >
                      <RefreshCcw size={14} />
                      Thử lại
                    </button>
                  ) : null}

                  {message.foods?.length ? (
                    <div className="lumora-chatbot-food-list">
                      {message.foods.map((food) => (
                        <FoodCard
                          key={food.id}
                          food={food}
                          qrToken={qrToken}
                          cart={cart}
                          onNavigate={navigateToFood}
                        />
                      ))}
                    </div>
                  ) : null}

                  {message.promotions?.length ? (
                    <div className="lumora-chatbot-promotion-list">
                      {message.promotions.map((promotion) => <PromotionCard key={promotion.id} promotion={promotion} />)}
                    </div>
                  ) : null}

                  {message.order ? <OrderCard order={message.order} /> : null}

                  {message.actions?.length ? (
                    <div className="lumora-chatbot-actions">
                      {message.actions.map((action, index) => (
                        <button type="button" key={`${action.action}-${index}`} onClick={() => handleAction(action)}>
                          {action.action === 'OPEN_RESERVATION' ? <CalendarCheck2 size={15} /> : null}
                          {action.action === 'CALL_RESTAURANT' ? <Phone size={15} /> : null}
                          {action.action === 'OPEN_MENU' ? <UtensilsCrossed size={15} /> : null}
                          {action.action === 'OPEN_CURRENT_ORDER' ? <Clock3 size={15} /> : null}
                          {action.action === 'OPEN_SERVICE_REQUEST' ? <MessageCircle size={15} /> : null}
                          {action.action === 'REQUIRE_TABLE_QR' ? <MapPin size={15} /> : null}
                          <span>{action.label || 'Tiếp tục'}</span>
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.disclaimer ? <p className="lumora-chatbot-disclaimer">{message.disclaimer}</p> : null}
                </div>
              </div>
            ))}

            {sending ? (
              <div className="lumora-chatbot-message assistant typing">
                <span className="lumora-chatbot-avatar"><Bot size={16} /></span>
                <div className="lumora-chatbot-bubble"><i /><i /><i /></div>
              </div>
            ) : null}
          </div>

          <div className="lumora-chatbot-quick-replies" aria-label="Câu hỏi gợi ý">
            {visibleQuickReplies.map((reply) => (
              <button type="button" key={reply} onClick={() => sendMessage(reply)} disabled={sending}>{reply}</button>
            ))}
          </div>

          <form className="lumora-chatbot-compose" onSubmit={onSubmit}>
            <label className="lumora-chatbot-input-wrap">
              <span className="lumora-chatbot-sr-only">Nhập câu hỏi</span>
              <textarea
                ref={inputRef}
                rows="1"
                maxLength="1000"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Hỏi về món ăn, ưu đãi, đặt bàn..."
              />
            </label>
            <button type="submit" disabled={!input.trim() || sending} aria-label="Gửi câu hỏi">
              {sending ? <LoaderCircle className="spin" size={19} /> : <Send size={18} />}
            </button>
          </form>
          <p className="lumora-chatbot-note">AI hỗ trợ hội thoại; món, giá, ưu đãi và đơn hàng luôn được xác minh từ hệ thống LUMORA.</p>
        </section>
      ) : null}

      <button
        type="button"
        className="lumora-chatbot-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Đóng LUMORA Assistant' : 'Mở LUMORA Assistant'}
      >
        {open ? <X size={22} /> : <Bot size={23} />}
        
        {hasUnread && !open ? <b /> : null}
      </button>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
