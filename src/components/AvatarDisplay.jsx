import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Trash2, Sparkles } from 'lucide-react';
import {
  getLocalPlayerProfile,
  updatePlayerAvatarEverywhere,
} from '../services/leaderboardService';

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
 * High-Definition (HD) square crop & progressive downscaling (`600x600` Retina HD).
 * Uses multi-step halving on HTML5 Canvas so high-megapixel smartphone photos stay razor-sharp
 * on Retina / 2x-3x DPI screens without pixelation or blur.
 */
export function compressProfileImage(file, options = {}) {
  const { maxDimension = 600, quality = 0.9 } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (JPG, PNG, atau WebP).'));
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('Ukuran foto terlalu besar (maksimal 15 MB).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        try {
          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minSide) / 2);
          const sy = Math.max(0, (img.height - minSide) / 2);

          // Do not upscale if source image is smaller than maxDimension
          const targetDim = Math.min(maxDimension, Math.max(256, minSide));

          const renderCrispSquare = (dim, q, mime = 'image/webp') => {
            // Step 1: Extract square crop at full or intermediate resolution, then progressively halve
            // to prevent bilinear aliasing blur on Safari/iOS/Chrome when downscaling large camera photos.
            let curDim = minSide;
            let stepCanvas = document.createElement('canvas');
            let stepCtx = stepCanvas.getContext('2d');

            if (curDim > dim * 2) {
              const firstStep = Math.max(dim * 2, Math.floor(curDim / 2));
              stepCanvas.width = firstStep;
              stepCanvas.height = firstStep;
              stepCtx.imageSmoothingEnabled = true;
              stepCtx.imageSmoothingQuality = 'high';
              stepCtx.drawImage(img, sx, sy, minSide, minSide, 0, 0, firstStep, firstStep);
              curDim = firstStep;

              while (curDim > dim * 2) {
                const nextDim = Math.max(dim, Math.floor(curDim / 2));
                const nextCanvas = document.createElement('canvas');
                nextCanvas.width = nextDim;
                nextCanvas.height = nextDim;
                const nextCtx = nextCanvas.getContext('2d');
                nextCtx.imageSmoothingEnabled = true;
                nextCtx.imageSmoothingQuality = 'high';
                nextCtx.drawImage(stepCanvas, 0, 0, curDim, curDim, 0, 0, nextDim, nextDim);
                stepCanvas = nextCanvas;
                curDim = nextDim;
              }
            } else {
              stepCanvas = null;
            }

            const canvas = document.createElement('canvas');
            canvas.width = dim;
            canvas.height = dim;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas tidak tersedia.');

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, dim, dim);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (stepCanvas) {
              ctx.drawImage(stepCanvas, 0, 0, curDim, curDim, 0, 0, dim, dim);
            } else {
              ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, dim, dim);
            }

            let dataUrl = canvas.toDataURL(mime, q);
            if (!dataUrl.startsWith(`data:${mime}`)) {
              dataUrl = canvas.toDataURL('image/jpeg', q);
            }
            return dataUrl;
          };

          // Render at 600x600 HD (2.5x Retina density for 240px preview)
          let result = renderCrispSquare(targetDim, quality, 'image/webp');
          // Only step down slightly if base64 exceeds ~110 KB
          if (result.length > 150000) {
            result = renderCrispSquare(512, 0.86, 'image/jpeg');
          }
          if (result.length > 150000) {
            result = renderCrispSquare(420, 0.82, 'image/jpeg');
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
 * Universal Avatar renderer with built-in Click-to-Preview HD Lightbox & Quick Photo Update:
 * - When `avatar` is an uploaded photo / image URL, renders an `<img>`.
 * - When `avatar` is an emoji/string, renders a `<span>`.
 * - Clicking the avatar opens a full-size Foto Profil preview modal (unless `clickable={false}`).
 */
export default function AvatarDisplay({
  avatar,
  fallback = '👑',
  size = null,
  className = '',
  style = undefined,
  alt = 'Foto Profil',
  playerName = '',
  clickable = true,
  editable = false,
  onAvatarChange = null,
}) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [previewVal, setPreviewVal] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isLegacyLowRes, setIsLegacyLowRes] = useState(false);
  const fileInputRef = useRef(null);

  const val = previewVal || avatar || fallback;
  const isImg = isImageAvatar(val);

  const handleOpenLightbox = (e) => {
    if (!clickable) return;
    e.stopPropagation();
    e.preventDefault();
    setPreviewVal(null);
    setUploadError('');
    setIsLegacyLowRes(false);
    setIsLightboxOpen(true);
  };

  const localProfile = getLocalPlayerProfile();
  const isMyOwnAvatar =
    editable ||
    (playerName &&
      localProfile.name &&
      playerName.trim().toLowerCase() === localProfile.name.trim().toLowerCase()) ||
    (!playerName && val === (localProfile.avatar || '👑'));

  const handleQuickUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setIsUploading(true);
    try {
      const compressed = await compressProfileImage(file, {
        maxDimension: 600,
        quality: 0.9,
      });
      setPreviewVal(compressed);
      setIsLegacyLowRes(false);
      await updatePlayerAvatarEverywhere(compressed);
      if (onAvatarChange) onAvatarChange(compressed);
    } catch (err) {
      setUploadError(err?.message || 'Gagal mengunggah foto profil.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    const defaultEmoji = '👑';
    setPreviewVal(defaultEmoji);
    setIsLegacyLowRes(false);
    await updatePlayerAvatarEverywhere(defaultEmoji);
    if (onAvatarChange) onAvatarChange(defaultEmoji);
  };

  const lightboxModal =
    isLightboxOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(5, 9, 18, 0.86)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              animation: 'fadeIn 0.18s ease-out',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '355px',
                background: 'linear-gradient(165deg, #0f172a 0%, #090d16 100%)',
                border: '1.5px solid rgba(251, 191, 36, 0.55)',
                borderRadius: '22px',
                padding: '1.3rem',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(245, 158, 11, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.95rem',
                position: 'relative',
                color: '#f8fafc',
              }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Tutup Foto Profil"
                style={{
                  position: 'absolute',
                  top: '0.85rem',
                  right: '0.85rem',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>

              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    letterSpacing: '0.12em',
                    color: '#fbbf24',
                    textTransform: 'uppercase',
                  }}
                >
                  FOTO PROFIL PEMAIN
                </span>
                {(playerName || (isMyOwnAvatar && localProfile.name)) && (
                  <h4
                    style={{
                      margin: '0.2rem 0 0',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      color: '#ffffff',
                    }}
                  >
                    {playerName || localProfile.name}
                  </h4>
                )}
              </div>

              {/* Enlarged HD Avatar Frame */}
              <div
                style={{
                  width: '240px',
                  height: '240px',
                  borderRadius: '24px',
                  background: 'radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 100%)',
                  border: '2.5px solid #fbbf24',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 20px rgba(251, 191, 36, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  fontSize: '5.5rem',
                  position: 'relative',
                }}
              >
                {isImageAvatar(val) ? (
                  <img
                    src={val}
                    alt={playerName || alt}
                    onLoad={(e) => {
                      const natW = e.currentTarget?.naturalWidth || 0;
                      if (natW > 0 && natW < 280) {
                        setIsLegacyLowRes(true);
                      } else {
                        setIsLegacyLowRes(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      imageRendering: 'auto',
                    }}
                  />
                ) : (
                  <span>{val}</span>
                )}
              </div>

              {isLegacyLowRes && isMyOwnAvatar && (
                <div
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#bae6fd',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    lineHeight: 1.4,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} style={{ flexShrink: 0, color: '#38bdf8' }} />
                  <span>
                    Klik <strong>Ganti Foto Profil</strong> dan pilih ulang fotomu untuk meningkatkan ke kualitas <strong>HD Jernih (600p)</strong>!
                  </span>
                </div>
              )}

              {uploadError && (
                <div
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.16)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    color: '#fca5a5',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  ⚠️ {uploadError}
                </div>
              )}

              {isMyOwnAvatar && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQuickUpload}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      width: '100%',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        padding: '0.62rem 0.9rem',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                        border: '1px solid #fef08a',
                        color: '#090d16',
                        fontSize: '0.8rem',
                        fontWeight: 900,
                        cursor: isUploading ? 'wait' : 'pointer',
                      }}
                    >
                      <Camera size={15} />
                      <span>
                        {isUploading
                          ? 'Memproses HD...'
                          : isImageAvatar(val)
                          ? 'Ganti Foto Profil (HD)'
                          : 'Upload Foto Profil (HD)'}
                      </span>
                    </button>

                    {isImageAvatar(val) && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        title="Hapus Foto"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.62rem 0.75rem',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.16)',
                          border: '1px solid rgba(239, 68, 68, 0.45)',
                          color: '#fca5a5',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  if (isImg) {
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
          cursor: clickable ? 'zoom-in' : undefined,
          ...style,
        }
      : {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 'inherit',
          display: 'block',
          flexShrink: 0,
          cursor: clickable ? 'zoom-in' : undefined,
          ...style,
        };

    return (
      <>
        <img
          src={val}
          alt={alt}
          className={`avatar-display-img ${className}`.trim()}
          style={imgStyle}
          draggable={false}
          onClick={clickable ? handleOpenLightbox : undefined}
          title={clickable ? 'Klik untuk melihat Foto Profil' : undefined}
        />
        {lightboxModal}
      </>
    );
  }

  return (
    <>
      <span
        className={className || undefined}
        style={{
          cursor: clickable ? 'pointer' : undefined,
          ...style,
        }}
        onClick={clickable ? handleOpenLightbox : undefined}
        title={clickable ? 'Klik untuk melihat / ganti Foto Profil' : undefined}
      >
        {val}
      </span>
      {lightboxModal}
    </>
  );
}
