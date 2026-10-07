import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function FaultAlert({ fault, onDismiss }) {
  useEffect(() => {
    if (!fault) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [fault, onDismiss]);

  if (!fault) return null;

  return (
    <div className="fault-alert-banner">
      <div className="fault-icon">
        <AlertTriangle color="#fca5a5" size={28} />
      </div>
      <div className="fault-content">
        <div className="fault-title">⚠️ PELANGGARAN ATURAN (FAULT DETECTED)</div>
        <div className="fault-desc">{fault.message}</div>
        {fault.penalty && (
          <div style={{ fontSize: '0.75rem', color: '#fecaca', marginTop: '3px', fontWeight: 600 }}>
            Penalti Poin: {fault.penalty}
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{ color: '#fff', marginLeft: '0.75rem', opacity: 0.8, padding: '4px' }}
        title="Tutup notifikasi"
      >
        <X size={18} />
      </button>
    </div>
  );
}
