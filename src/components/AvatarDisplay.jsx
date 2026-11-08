import React from 'react';

/**
 * Checks whether an avatar value is an uploaded photo / image URL rather than an emoji/text.
 */
export function isImageAvatar(avatar) {
  if (typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Compresses & center-crops an image File into a lightweight square data URL (~4–12 KB)
 * suitable for localStorage, Supabase leaderboard, room state, and Realtime broadcasts.
 */
export function compressProfileImage(file, options = {}) {
  const { maxDimension = 144, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (JPG, PNG, atau WebP).'));
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Ukuran foto terlalu besar (maksimal 12 MB).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        try {
          const renderSquare = (dim, q, mime = 'image/webp') => {
            const canvas = document.createElement('canvas');
            canvas.width = dim;
            canvas.height = dim;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas tidak tersedia.');

            // Fill dark background in case of transparent PNG
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, dim, dim);

            // Center-crop square
            const minSide = Math.min(img.width, img.height);
            const sx = Math.max(0, (img.width - minSide) / 2);
            const sy = Math.max(0, (img.height - minSide) / 2);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, dim, dim);

            let dataUrl = canvas.toDataURL(mime, q);
            if (!dataUrl.startsWith(`data:${mime}`)) {
              dataUrl = canvas.toDataURL('image/jpeg', q);
            }
            return dataUrl;
          };

          let result = renderSquare(maxDimension, quality, 'image/webp');
          // If WebP wasn't supported or file is still > 16KB, try JPEG / smaller dimension
          if (result.length > 16000) {
            result = renderSquare(128, 0.76, 'image/jpeg');
          }
          if (result.length > 16000) {
            result = renderSquare(108, 0.7, 'image/jpeg');
          }

          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Universal Avatar renderer:
 * - When `avatar` is an uploaded photo / image URL, renders an `<img>`.
 * - When `avatar` is an emoji/string, renders a `<span>`.
 * - Pass `size` (e.g. `size={26}` or `size="1.4em"`) when used inline outside a fixed avatar frame.
 */
export default function AvatarDisplay({
  avatar,
  fallback = '👑',
  size = null,
  className = '',
  style = undefined,
  alt = 'Avatar',
}) {
  const val = avatar || fallback;

  if (isImageAvatar(val)) {
    const imgStyle = size
      ? {
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style,
        }
      : {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 'inherit',
          display: 'block',
          flexShrink: 0,
          ...style,
        };

    return (
      <img
        src={val}
        alt={alt}
        className={`avatar-display-img ${className}`.trim()}
        style={imgStyle}
        draggable={false}
      />
    );
  }

  return (
    <span className={className || undefined} style={style}>
      {val}
    </span>
  );
}
