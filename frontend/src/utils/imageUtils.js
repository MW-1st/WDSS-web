export const getImageUrl = (s3_key) => {
  if (!s3_key) return null;

  if (s3_key.startsWith('http://') || s3_key.startsWith('https://')) {
    return s3_key;
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // s3_key가 'api/uploads/...'로 시작한다면 'api/'를 제거
  const cleanPath = s3_key.replace(/^\/api\//, '');
  return `${baseUrl}/${cleanPath}`;
};