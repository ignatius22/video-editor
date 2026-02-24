const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

// Auth
export const login = (username, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const register = (username, email, password) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });

export const logout = () =>
  request('/auth/logout', { method: 'POST' });

export const getUser = () =>
  request('/auth/user');

// Billing
export const getTransactions = (limit = 50, offset = 0) =>
  request(`/billing/transactions?limit=${limit}&offset=${offset}`);

export const buyCredits = (amount, description) =>
  request('/billing/buy-credits', {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });

export const upgradeTier = (tier = 'pro') =>
  request('/billing/upgrade', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });

// Videos
export const getVideos = () =>
  request('/videos');

export const uploadVideo = async (file, onProgress) => {
  const res = await fetch(`${API_BASE}/videos/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/octet-stream',
      'filename': file.name,
    },
    body: file,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Upload failed');
  }
  return res.json();
};

export const resizeVideo = (videoId, width, height) =>
  request('/videos/resize', {
    method: 'POST',
    body: JSON.stringify({ videoId, width, height }),
  });

export const convertVideo = (videoId, format) =>
  request('/videos/convert', {
    method: 'POST',
    body: JSON.stringify({ videoId, targetFormat: format }),
  });

export const extractAudio = (videoId, format) =>
  request('/videos/extract-audio', {
    method: 'POST',
    body: JSON.stringify({ videoId, format }),
  });

export const getVideoAssetUrl = (videoId, type = 'original') =>
  `${API_BASE}/videos/asset?videoId=${videoId}&type=${type}`;

// Images
export const getImages = () =>
  request('/images');

export const uploadImage = async (file) => {
  const res = await fetch(`${API_BASE}/images/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/octet-stream',
      'filename': file.name,
    },
    body: file,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Upload failed');
  }
  return res.json();
};

export const cropImage = (imageId, width, height, x, y) =>
  request('/images/crop', {
    method: 'POST',
    body: JSON.stringify({ imageId, width, height, x, y }),
  });

export const resizeImage = (imageId, width, height) =>
  request('/images/resize', {
    method: 'POST',
    body: JSON.stringify({ imageId, width, height }),
  });

export const convertImage = (imageId, format) =>
  request('/images/convert', {
    method: 'POST',
    body: JSON.stringify({ imageId, targetFormat: format }),
  });

export const getImageAssetUrl = (imageId, type = 'original') =>
  `${API_BASE}/images/asset?imageId=${imageId}&type=${type}`;
