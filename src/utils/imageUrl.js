import { API_BASE_URL } from '../api/axiosClient';

export function imageUrl(src) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) return src;
  return `${API_BASE_URL}${src.startsWith('/') ? src : `/${src}`}`;
}
