import React from 'react';
import { History, X, AlertTriangle, Flame } from 'lucide-react';

export default function MatchHistoryDrawer({ actionLog = [], onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History color="#fbbf24" size={20} />
            <h2 className="modal-title">RIWAYAT PERTANDINGAN (MATCH LOG)</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh' }}>
          {actionLog.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
              Belum ada aksi yang tercatat.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actionLog.map((log, index) => {
                const isFault = log.type === 'FAULT';
                const isClose = log.type === 'CLOSE';
                const isAceClosed = isClose && log.card?.rank === 1;

                let borderCol = 'rgba(255, 255, 255, 0.06)';
                let bgCol = 'rgba(255, 255, 255, 0.02)';
                if (isFault) {
                  borderCol = 'rgba(239, 68, 68, 0.4)';
                  bgCol = 'rgba(239, 68, 68, 0.1)';
                } else if (isAceClosed) {
                  borderCol = 'rgba(245, 158, 11, 0.4)';
                  bgCol = 'rgba(245, 158, 11, 0.12)';
                }

                return (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${borderCol}`,
                      background: bgCol,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        fontSize: '0.725rem',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    >
                      T{log.turn}
                    </span>

                    {isFault && <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />}
                    {isAceClosed && <Flame size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />}

                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          color: isFault ? '#fca5a5' : isAceClosed ? '#fde68a' : 'var(--text-primary)',
                          fontWeight: isFault || isAceClosed ? 700 : 500,
                        }}
                      >
                        {log.message}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-header" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
