import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin } from 'lucide-react';
import { loadGoogleMaps } from '../../utils/googleMaps';

function componentText(components, types) {
  for (const wanted of types) {
    const found = components.find((component) => Array.isArray(component?.types) && component.types.includes(wanted));
    const text = found?.longText || found?.long_name || '';
    if (text) return text;
  }
  return '';
}

function placeToDeliveryAddress(place) {
  const components = Array.isArray(place?.addressComponents)
    ? place.addressComponents
    : (Array.isArray(place?.address_components) ? place.address_components : []);
  const streetNumber = componentText(components, ['street_number']);
  const route = componentText(components, ['route']);
  const detail = [streetNumber, route].filter(Boolean).join(' ').trim();
  const phuongXa = componentText(components, [
    'administrative_area_level_3',
    'sublocality_level_2',
    'sublocality_level_1',
    'neighborhood',
  ]);
  const quanHuyen = componentText(components, [
    'administrative_area_level_2',
    'sublocality_level_1',
  ]);
  const tinhThanh = componentText(components, ['administrative_area_level_1', 'locality']) || 'Đà Nẵng';
  const location = place?.location || place?.geometry?.location;
  const latitude = typeof location?.lat === 'function' ? location.lat() : location?.lat;
  const longitude = typeof location?.lng === 'function' ? location.lng() : location?.lng;
  const formattedAddress = place?.formattedAddress || place?.formatted_address || '';
  const placeId = place?.id || place?.place_id || '';
  const displayName = place?.displayName || place?.name || '';

  return {
    placeId,
    formattedAddress,
    displayName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    diaChiChiTiet: detail || formattedAddress || '',
    phuongXa: phuongXa || '',
    quanHuyen: quanHuyen || '',
    tinhThanh: tinhThanh || 'Đà Nẵng',
  };
}

export default function GooglePlaceAutocomplete({
  value = '',
  onChange,
  onPlaceSelected,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const onSelectRef = useRef(onPlaceSelected);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('Đang tải gợi ý địa chỉ...');

  useEffect(() => { onSelectRef.current = onPlaceSelected; }, [onPlaceSelected]);

  useEffect(() => {
    let active = true;
    let autocomplete;
    let listener;

    async function init() {
      try {
        await loadGoogleMaps();
        const places = await window.google.maps.importLibrary('places');
        if (!active || !inputRef.current) return;

        const Autocomplete = places?.Autocomplete || window.google?.maps?.places?.Autocomplete;
        if (!Autocomplete) throw new Error('Google Maps chưa sẵn sàng gợi ý địa chỉ.');

        autocomplete = new Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'vn' },
          fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components'],
          types: ['geocode'],
        });

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const parsed = placeToDeliveryAddress(place);
          if (!parsed.placeId || !parsed.formattedAddress) {
            setState('ready');
            setMessage('Bạn có thể tiếp tục nhập địa chỉ, không bắt buộc chọn gợi ý Google Maps.');
            return;
          }
          onSelectRef.current?.(parsed);
          setState('ready');
          setMessage('Đã xác định địa chỉ từ Google Maps.');
        });

        setState('ready');
        setMessage('Nhập địa chỉ bình thường; gợi ý Google Maps chỉ để chọn nhanh, không bắt buộc.');
      } catch (error) {
        if (!active) return;
        setState('error');
        setMessage('Bạn vẫn có thể nhập địa chỉ bình thường để hệ thống tự xác định.');
      }
    }

    init();
    return () => {
      active = false;
      if (listener?.remove) listener.remove();
      else if (listener && window.google?.maps?.event) window.google.maps.event.removeListener(listener);
    };
  }, []);

  return (
    <div className="google-place-autocomplete-wrap">
      <div className="google-place-input-shell">
        <MapPin size={18} />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
          maxLength={500}
          autoComplete="off"
          placeholder="Số nhà, tên đường, phường/xã..."
          aria-label="Địa chỉ giao hàng"
        />
      </div>
      <small className={`google-place-help ${state}`}>
        {state === 'loading' ? <LoaderCircle className="spin" size={14} /> : <MapPin size={14} />}
        {message}
      </small>
    </div>
  );
}
