import React, { useState } from 'react';
import CardView from './CardView.jsx';
import { cardEquals } from '../engine/deck.js';
import { ArrowUpDown, Lock, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { getCardBasePenalty } from '../engine/scoring.js';

export default function PlayerHand({
  player,
  hand = [],
  selectedCard,
  onSelectCard,
  onPlayCard,
  onCloseCard,
  sortBy = 'suit',
  onToggleSort,
  isCurrentTurn = false,
  closedCards = [],
  globalAceDirection = null,
  config = null,
}) {
  const [showClosedDetails, setShowClosedDetails] = useState(false);
  const isSelectedInHand = selectedCard && hand.some(c => cardEquals(c, selectedCard));

  const totalClosedPenalty = closedCards.reduce((sum, c) => {
    return sum + getCardBasePenalty(c, config || {}, globalAceDirection);
  }, 0);

  return (
    <div className="player-tray">
      {/* Tray Header */}
      <div className="tray-header">
        <div className="tray-title-group">
          <div className="tray-player-badge">
            <span style={{ fontSize: '1.25rem' }}>{player.avatar}</span>
            <span>{player.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ({hand.length} kartu di tangan)
            </span>
          </div>
        </div>

        {/* Tray Toggles: Sorting & Closed Cards Detail */}
        <div className="tray-toggles">
          {/* Closed Cards Inspection Toggle */}
          <button
            className={`toggle-chip toggle-chip-closed ${showClosedDetails ? 'active' : ''} ${
              closedCards.length > 0 ? 'has-cards' : ''
            }`}
            onClick={() => setShowClosedDetails(!showClosedDetails)}
            title="Lihat rincian kartu yang sudah Anda tutup sendiri beserta estimasi penaltinya"
          >
            <Lock size={13} />
            <span>Ditutup: <strong>{closedCards.length}</strong></span>
            {closedCards.length > 0 && (
              <span className="tray-closed-pts-chip">({totalClosedPenalty} pts)</span>
            )}
            {showClosedDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Card Sorting Toggle */}
          <button
            className="toggle-chip"
            onClick={onToggleSort}
            title="Urutkan kartu berdasarkan Suit (simbol) atau Rank (angka)"
          >
            <ArrowUpDown size={13} />
            <span>Urut: {sortBy === 'suit' ? 'Suit' : 'Rank'}</span>
          </button>
        </div>
      </div>

      {/* DETAILED CLOSED CARDS DRAWER (When open) */}
      {showClosedDetails && (
        <div className="closed-cards-drawer">
          <div className="closed-drawer-header">
            <div className="closed-drawer-title-row">
              <span className="closed-lock-icon">🔒</span>
              <span className="closed-drawer-title">
                Rincian Kartu yang Anda Tutup ({closedCards.length} kartu)
              </span>
              <span className="closed-drawer-badge-pts">
                Total Penalti: <strong>{totalClosedPenalty} poin</strong>
              </span>
            </div>
            <button
              className="btn-close-drawer-x"
              onClick={() => setShowClosedDetails(false)}
              title="Tutup Panel"
            >
              ✕
            </button>
          </div>

          {closedCards.length === 0 ? (
            <div className="closed-empty-box">
              <span>🂠 Belum ada kartu yang Anda tutup. Kartu yang Anda tutup saat tidak bisa melangkah akan muncul di sini secara detail.</span>
            </div>
          ) : (
            <div className="closed-cards-flex-list">
              {closedCards.map((c, idx) => {
                const penalty = getCardBasePenalty(c, config || {}, globalAceDirection);
                const isRed = c.suit === 'hearts' || c.suit === 'diamonds';

                return (
                  <div
                    key={c.id || idx}
                    className={`closed-card-tag ${isRed ? 'tag-red' : 'tag-black'}`}
                    title={`Kartu ${c.label}${c.symbol}: penalti ${penalty} poin`}
                  >
                    <span className="closed-tag-symbol">{c.symbol}</span>
                    <span className="closed-tag-rank">{c.label}</span>
                    <span className="closed-tag-pts">{penalty}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="closed-drawer-footer-note">
            ℹ️ <em>Hitungan penalti: Kartu 2-10 bernilai -2 s/d -10. <strong>Kartu J, Q, dan K masing-masing bernilai -10</strong>. Kartu As bernilai {globalAceDirection === 'bottom' ? '-1 (Tutup Bawah)' : globalAceDirection === 'top' ? '-11 (Tutup Atas)' : '-1 / -11'}.</em>
          </div>
        </div>
      )}

      {/* Cards Fan / Row - All cards visually equal, NO hints */}
      <div className="hand-cards-container">
        {hand.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1.5rem' }}>
            Tangan kosong. Semua kartu telah dimainkan atau ditutup.
          </div>
        ) : (
          hand.map((card) => {
            const isSelected = cardEquals(selectedCard, card);

            return (
              <CardView
                key={card.id}
                card={card}
                isSelected={isSelected}
                onClick={() => onSelectCard(card)}
              />
            );
          })
        )}
      </div>

      {/* Action Controls Bar */}
      <div className="action-controls-bar">
        <div className="action-status-indicator">
          {isCurrentTurn ? (
            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              Giliran Anda. Pilih kartu dari tangan Anda untuk dimainkan atau ditutup.
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Menunggu giliran pemain lain...
            </div>
          )}
        </div>

        <div className="action-buttons-group">
          {/* Play Card Button */}
          <button
            className="btn-action btn-play"
            disabled={!isCurrentTurn || !isSelectedInHand}
            onClick={() => selectedCard && onPlayCard(selectedCard)}
          >
            <span>Mainkan</span>
            {selectedCard && isSelectedInHand && (
              <span style={{ fontWeight: 800 }}>({selectedCard.label}{selectedCard.symbol})</span>
            )}
          </button>

          {/* Close Card Button */}
          <button
            className="btn-action btn-close-card"
            disabled={!isCurrentTurn || !isSelectedInHand}
            onClick={() => selectedCard && onCloseCard(selectedCard)}
          >
            <span>Tutup Kartu (Close)</span>
            {selectedCard && isSelectedInHand && (
              <span style={{ fontWeight: 800 }}>({selectedCard.label}{selectedCard.symbol})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
