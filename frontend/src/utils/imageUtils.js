export const getImageUrl = (s3_key) => {
  if (!s3_key) return null;

  if (s3_key.startsWith('http://') || s3_key.startsWith('https://')) {
    return s3_key;
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // s3_key가 'api/uploads/...'로 시작한다면 'api/'를 제거
  let cleanPath;

  if (s3_key.startsWith('/api/')) {
   // api로 시작하면 api 부분만 제거
   cleanPath = s3_key.replace(/^\/api\//, '');
  } else if (s3_key.startsWith('originals/')) {
   // originals로 시작하면 processed로 변경하고 png를 svg로 변경
   cleanPath = s3_key.replace(/^originals\//, 'processed/')
                    .replace(/\.png$/, '.svg');
  } else {
   // 그 외의 경우는 그대로 사용
   cleanPath = s3_key;
  }
  return `${baseUrl}/${cleanPath}`;
};