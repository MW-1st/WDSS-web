export const getImageUrl = (s3_key) => {
  if (!s3_key) return null;

  if (s3_key.startsWith('http://') || s3_key.startsWith('https://')) {
    return s3_key;
  }

  // Vite 프록시를 사용하도록 상대 경로로 반환
  const cleanPath = s3_key.replace(/^\/api\//, '').replace(/^\//, '');
  return `/${cleanPath}`;
};