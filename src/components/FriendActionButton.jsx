import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  UserCheck,
  Clock,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  subscribeToFriendEvents,
} from '../services/friendService.js';
import AvatarDisplay from './AvatarDisplay.jsx';

/**
 * Reusable Add Friend / Friendship Status Button for Player Rows & Cards
 */
export default function FriendActionButton({
  targetPlayer,
  myUsername,
  myProfile,
  onStatusChange,
  onRequestUnfriend,
  size = 'md',
  className = '',
}) {
  const targetName = targetPlayer?.name || targetPlayer?.player_name;
  const [status, setStatus] = useState(() =>
    targetName && myUsername ? getFriendshipStatus(myUsername, targetName) : 'none'
  );

  useEffect(() => {
    if (!targetName || !myUsername) return;
    setStatus(getFriendshipStatus(myUsername, targetName));

    const unsub = subscribeToFriendEvents(myUsername, () => {
      setStatus(getFriendshipStatus(myUsername, targetName));
    });
    return () => unsub();
  }, [targetName, myUsername]);

  if (!targetName || !myUsername) return null;

  const handleClick = async (e) => {
    e.stopPropagation();

    if (status === 'friend') {
      if (onRequestUnfriend) {
        onRequestUnfriend({
          name: targetName,
          avatar: targetPlayer.avatar,
        });
      }
    } else if (status === 'pending_incoming') {
      const senderObj = {
        name: targetName,
        avatar: targetPlayer.avatar || '👤',
        tier: targetPlayer.tier || null,
        score: targetPlayer.score || 0,
        wins: targetPlayer.wins || 0,
      };
      const res = await acceptFriendRequest(myUsername, myProfile, senderObj);
      if (res?.success) {
        setStatus('friend');
        onStatusChange?.(`Sekarang kamu berteman dengan ${targetName}!`);
      }
    } else if (status === 'pending_outgoing') {
      onStatusChange?.(`Permintaan pertemanan sudah dikirim ke ${targetName}, menunggu konfirmasi.`);
    } else {
      const res = await sendFriendRequest(myUsername, myProfile, {
        name: targetName,
        avatar: targetPlayer.avatar || '👤',
        tier: targetPlayer.tier || null,
        score: targetPlayer.score || 0,
        wins: targetPlayer.wins || 0,
      });
      if (res?.success) {
        setStatus('pending_outgoing');
        onStatusChange?.(`Permintaan pertemanan dikirim ke ${targetName}!`);
      } else if (res?.error) {
        onStatusChange?.(res.error);
      }
    }
  };

  return (
    <button
      type="button"
      className={`victory-friend-btn status-${status} size-${size} ${className}`}
      onClick={handleClick}
      title={
        status === 'friend'
          ? `${targetName} sudah berteman (Klik untuk Hapus)`
          : status === 'pending_outgoing'
          ? 'Menunggu Konfirmasi'
          : status === 'pending_incoming'
          ? 'Terima Permintaan Pertemanan'
          : `Kirim Permintaan Pertemanan ke ${targetName}`
      }
    >
      {status === 'friend' ? (
        <>
          <UserCheck size={size === 'sm' ? 10 : 12} />
          <span>Teman</span>
        </>
      ) : status === 'pending_outgoing' ? (
        <>
          <Clock size={size === 'sm' ? 10 : 12} />
          <span>Pending</span>
        </>
      ) : status === 'pending_incoming' ? (
        <>
          <UserPlus size={size === 'sm' ? 10 : 12} />
          <span>Terima</span>
        </>
      ) : (
        <>
          <UserPlus size={size === 'sm' ? 10 : 12} />
          <span>+ Teman</span>
        </>
      )}
    </button>
  );
}

/**
 * Reusable Confirmation Dialog for Unfriending
 */
export function FriendUnfriendModal({ friendToDelete, onClose, onConfirm }) {
  if (!friendToDelete) return null;

  return (
    <div className="friends-confirm-overlay" onClick={onClose}>
      <div className="friends-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon-box">
          <AlertTriangle size={24} className="confirm-warning-icon" />
        </div>

        <h3 className="confirm-title">Hapus Pertemanan?</h3>

        <div className="confirm-profile-preview">
          <AvatarDisplay avatar={friendToDelete.avatar} fallback="👤" size={28} />
          <strong>{friendToDelete.name}</strong>
        </div>

        <p className="confirm-desc">
          Apakah kamu yakin ingin menghapus <strong style={{ color: '#fff' }}>{friendToDelete.name}</strong> dari daftar teman? Kalian tidak lagi bisa saling mengirim DM cepat.
        </p>

        <div className="confirm-btn-row">
          <button type="button" className="btn-confirm-cancel" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn-confirm-delete" onClick={onConfirm}>
            <Trash2 size={14} />
            <span>Ya, Hapus</span>
          </button>
        </div>
      </div>
    </div>
  );
}

