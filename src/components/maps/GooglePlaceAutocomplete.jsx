import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin } from 'lucide-react';
import { loadGoogleMaps } from '../../utils/googleMaps';

function componentText(components, types) {
  for (const wanted of types) {
    const found = components.find((component) => Array.isArray(component?.types) && component.types.includes(wanted));
    if (found?.longText) return found.longText;
  }
  return '';
}

function placeToDeliveryAddress(place) {
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
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
  const location = place?.location;
  const latitude = typeof location?.lat === 'function' ? location.lat() : location?.lat;
  const longitude = typeof location?.lng === 'function' ? location.lng() : location?.lng;

  return {
    placeId: place?.id || '',
    formattedAddress: place?.formattedAddress || '',
    displayName: place?.displayName || '',
    latitude: Number(latitude),
    longitude: Number(longitude),
    diaChiChiTiet: detail || place?.formattedAddress || '',
    phuongXa: phuongXa || '',
    quanHuyen: quanHuyen || '',
    tinhThanh: tinhThanh || 'Đà Nẵng',
  };
}

export default function GooglePlaceAutocomplete({ onPlaceSelected, disabled = false }) {
  const hostRef = useRef(null);
  const onSelectRef = useRef(onPlaceSelected);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('Đang tải Google Maps...');

  useEffect(() => { onSelectRef.current = onPlaceSelected; }, [onPlaceSelected]);

  useEffect(() => {
    let active = true;
    let element;
    let listener;

    async function init() {
      try {
        await loadGoogleMaps();
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
        if (!active || !hostRef.current) return;

        element = new PlaceAutocompleteElement();
        element.includedRegionCodes = ['vn'];
        element.placeholder = 'Nhập số nhà, tên đường hoặc địa điểm giao hàng';
        element.style.width = '100%';
        element.style.display = 'block';
        if (disabled) element.disabled = true;

        listener = async ({ placePrediction }) => {
          if (!placePrediction) return;
          setState('loading');
          setMessage('Đang xác định địa chỉ...');
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents'],
            });
            const value = placeToDeliveryAddress(place);
            if (!value.placeId || !value.formattedAddress || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
              throw new Error('Địa chỉ Google Maps chưa đủ dữ liệu.');
            }
            onSelectRef.current?.(value);
            setState('ready');
            setMessage('Đã chọn địa chỉ từ Google Maps');
          } catch (error) {
            setState('error');
            setMessage(error?.message || 'Không thể đọc địa chỉ Google Maps.');
          }
        };

        element.addEventListener('gmp-select', listener);
        hostRef.current.replaceChildren(element);
        setState('ready');
        setMessage('Chọn một địa chỉ trong danh sách gợi ý của Google Maps');
      } catch (error) {
        if (!active) return;
        setState('error');
        setMessage(error?.message || 'Không thể tải Google Maps.');
      }
    }

    init();
    return () => {
      active = false;
      if (element && listener) element.removeEventListener('gmp-select', listener);
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [disabled]);

  return (
    <div className="google-place-autocomplete-wrap">
      <div ref={hostRef} className="google-place-autocomplete-host" />
      <small className={`google-place-help ${state}`}>
        {state === 'loading' ? <LoaderCircle className="spin" size={14} /> : <MapPin size={14} />}
        {message}
      </small>
    </div>
  );
}
