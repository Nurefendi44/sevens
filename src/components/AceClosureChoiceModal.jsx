import React from 'react';
import { SUIT_NAMES, SUIT_SYMBOLS } from '../engine/constants.js';
import { ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react';

export default function AceClosureChoiceModal({ card, onChoose, onCancel }) {
  if (!card) return null;

  const suitName = SUIT_NAMES[card.suit] || card.suit;
  const suitSymbol = SUIT_SYMBOLS[card.suit] || card.symbol;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px' }}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <div>
              <h2 className="modal-title">Tutup Rangkai: {suitName} {suitSymbol}</h2>
              <p className="modal-subtitle">
                Rangkaian pada meja telah lengkap dari 2 hingga King! Tentukan arah penutupan pertama:
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          {/* Option ATAS */}
          <div
            onClick={() => onChoose('top')}
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.16)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 800, fontSize: '1.05rem' }}>
              <ArrowUpCircle size={22} />
              <span>⬆️ TUTUP RANGKAI ATAS (King → As)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.4rem', color: '#fef3c7', fontSize: '0.825rem', lineHeight: 1.5 }}>
              <li>Mengunci arah penutupan global ke <strong>ATAS</strong> untuk seluruh sisa game.</li>
              <li>Pemain lain yang masih memegang <strong>kartu 6</strong> terkena penalti <strong>-60</strong>!</li>
              <li>Kartu As yang ditutup telungkup dihitung penalti <strong>-11</strong>.</li>
              <li>Sisa kartu bawah (2-5) yang belum keluar terkunci permanen.</li>
            </ul>
          </div>

          {/* Option BAWAH */}
          <div
            onClick={() => onChoose('bottom')}
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '10px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.16)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 800, fontSize: '1.05rem' }}>
              <ArrowDownCircle size={22} />
              <span>⬇️ TUTUP RANGKAI BAWAH (2 → As)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.4rem', color: '#d1fae5', fontSize: '0.825rem', lineHeight: 1.5 }}>
              <li>Mengunci arah penutupan global ke <strong>BAWAH</strong> untuk seluruh sisa game.</li>
              <li>Pemain lain yang masih memegang <strong>kartu 8</strong> terkena penalti <strong>-80</strong>!</li>
              <li>Kartu As yang ditutup telungkup dihitung penalti <strong>-1</strong>.</li>
              <li>Sisa kartu atas (9-K) yang belum keluar terkunci permanen.</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-header" onClick={onCancel} style={{ padding: '8px 16px' }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
