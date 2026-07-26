export function profileAvatarOf(profile) {
  if (!profile || typeof profile !== 'object') return '';

  if (Object.prototype.hasOwnProperty.call(profile, 'anhDaiDien')) {
    return profile.anhDaiDien || '';
  }

  return profile.photo
    || profile.avatar
    || profile.avatarUrl
    || profile.hinhAnh
    || profile.imageUrl
    || '';
}
