import React, { useState } from 'react';
import { Settings, Save, RotateCcw, X, Info } from 'lucide-react';
import { DEFAULT_CONFIG } from '../engine/config.js';

export default function ConfigModal({ currentConfig, onSaveConfig, onClose }) {
  const [config, setConfig] = useState({ ...currentConfig });

  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetToDefault = () => {
    setConfig({ ...DEFAULT_CONFIG });
  };

  const handleSave = () => {
    onSaveConfig(config);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings color="#fbbf24" size={20} />
            <h2 className="modal-title">PENGATURAN ATURAN & PENALTI</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Rule 6 Info Box */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: '#fef3c7',
            display: 'flex',
            gap: '8px',
          }}>
            <Info size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div>
              <strong>Rule 6 — Penalti Kartu 6 & 8:</strong> Didesain sepenuhnya modular dan dapat disesuaikan.
              Bila ada kartu AS yang ditutup, pemain yang masih menyimpan 6 dan 8 akan terkena penalti nilai minus di bawah ini.
            </div>
          </div>

          {/* Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Player Count Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                Jumlah Pemain (Player Count)
              </label>
              <select
                value={config.playerCount || 4}
                onChange={(e) => handleChange('playerCount', parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fbbf24',
                  fontWeight: 700,
                }}
              >
                <option value={4}>4 Pemain (13 kartu/orang, meja mulai kosong)</option>
                <option value={5}>5 Pemain (10 kartu/orang, ♠7 & ♥7 otomatis di meja)</option>
                <option value={6}>6 Pemain (8 kartu/orang, semua kartu 7 otomatis di meja)</option>
              </select>
            </div>

            {/* Penalty 6 & 8 values */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                  Penalti Kartu 6 (Default: -60)
                </label>
                <input
                  type="number"
                  value={config.penalty6}
                  onChange={(e) => handleChange('penalty6', parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                  Penalti Kartu 8 (Default: -80)
                </label>
                <input
                  type="number"
                  value={config.penalty8}
                  onChange={(e) => handleChange('penalty8', parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            </div>

            {/* Scope selection */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                Lingkup Suit Penalti 6 & 8 (Suit Scope)
              </label>
              <select
                value={config.penalty68Scope}
                onChange={(e) => handleChange('penalty68Scope', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                }}
              >
                <option value="same_suit">Same Suit (Hanya 6 & 8 dari suit yang sama dengan As yang ditutup)</option>
                <option value="all_suits">All Suits (Semua 6 & 8 di hand pemain terkena penalti saat As ditutup)</option>
              </select>
            </div>

            {/* Evaluation mode */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                Waktu Evaluasi Penalti 6 & 8
              </label>
              <select
                value={config.penalty68EvaluationMode}
                onChange={(e) => handleChange('penalty68EvaluationMode', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                }}
              >
                <option value="held_when_ace_closed">Saat As Ditutup (Mencatat snapshot pemain yang memegang saat kejadian)</option>
                <option value="unplayed_at_end">Akhir Permainan (Kartu 6/8 yang tidak pernah dimainkan ke board)</option>
              </select>
            </div>

            {/* Base closed card scoring */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                  Mode Skor Kartu Tutup (Base)
                </label>
                <select
                  value={config.closedCardScoringMode}
                  onChange={(e) => handleChange('closedCardScoringMode', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                >
                  <option value="face_value">Face Value (A=-1, 2=-2... K=-13)</option>
                  <option value="flat_ten">Flat (-10 per kartu)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
                  Penalti FAULT per Pelanggaran
                </label>
                <input
                  type="number"
                  value={config.faultPenalty}
                  onChange={(e) => handleChange('faultPenalty', parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-header"
            onClick={handleResetToDefault}
            style={{ marginRight: 'auto' }}
          >
            <RotateCcw size={14} />
            <span>Reset Default</span>
          </button>

          <button className="btn-header" onClick={onClose}>
            Batal
          </button>

          <button className="btn-header btn-gold" onClick={handleSave}>
            <Save size={14} />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
