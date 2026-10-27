import React from 'react';
import { X, Check, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';

export default function RulesGuideBigTwoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '92vw', maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🃏</span>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.3rem', fontWeight: 800 }}>
              PANDUAN ATURAN BIG TWO (CAPSA BANTING)
            </h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', lineHeight: '1.55' }}>
          
          {/* Card Values */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '10px' }}>
            <h4 style={{ color: '#38bdf8', fontWeight: 700, margin: '0 0 6px 0' }}>
              1. Nilai Kartu & Lambang (Hierarki Big Two)
            </h4>
            <p style={{ margin: '0 0 6px 0' }}>
              Di permainan Big Two, angka <strong>2 adalah kartu tertinggi</strong>, dan angka <strong>3 adalah kartu terendah</strong>:
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.05em' }}>
              3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; As &lt; 2 (BIG TWO)
            </div>
            <p style={{ margin: '8px 0 0 0' }}>
              Urutan lambang (suit) dari terendah ke tertinggi:
              <br />
              <strong>♦ Wajik (1) &lt; ♣ Keriting (2) &lt; ♥ Hati (3) &lt; ♠ Sekop (4)</strong>
              <br />
              <em>*Kartu terendah dalam permainan adalah <strong>3 Wajik (3♦)</strong> dan kartu tertinggi adalah <strong>2 Sekop (2♠)</strong>.</em>
            </p>
          </div>

          {/* Strict Rules */}
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px 16px', borderRadius: '10px' }}>
            <h4 style={{ color: '#f87171', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} /> ATURAN KHUSUS BIG TWO
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>
                <strong>DILARANG Kartu 2 Menjadi Kartu Terakhir (Kalah Otomatis):</strong> Kartu angka 2 tidak boleh menjadi kartu terakhir yang dikeluarkan untuk menghabiskan kartu tangan. Misalnya Anda memegang 2 dan 5, maka Anda harus mengeluarkan kartu 2 terlebih dahulu, baru kemudian kartu 5. <em>Jika kartu terakhir Anda adalah 2, Anda dinyatakan <strong>OTOMATIS KALAH</strong> dan pemain lain dengan kartu tersedikit menjadi pemenang!</em>
              </li>
              <li>
                <strong>Sistem Pass dalam Satu Rangkaian (Dilewati Hingga Meja Bebas):</strong> Jika Anda menekan <strong>Pass (Lewat)</strong> dalam satu putaran/rangkaian, Anda akan <strong>dilewati</strong> dan tidak berhak jalan lagi di putaran tersebut hingga kartu di meja dibersihkan (Meja Bebas). Setelah meja bebas, semua pemain berhak bermain kembali!
              </li>
              <li>
                <strong>DILARANG Mengeluarkan Double Pair:</strong> Kombinasi 4 kartu berupa 2 pasang (seperti 5-5-8-8) tidak sah dan tidak boleh dikeluarkan.
              </li>
              <li>
                <strong>DILARANG Mengeluarkan Bomb 4 Kartu:</strong> 4 kartu kembar tanpa kartu buangan tidak boleh dikeluarkan. Four of a Kind <strong>wajib berjumlah 5 kartu</strong> (4 kartu angka sama + 1 kartu buangan/kicker).
              </li>
              <li>
                <strong>Pilihan Deck untuk Pemain &gt; 4 Orang:</strong> Jika pemain 5 atau 6 orang, Host dapat memilih menggunakan <strong>Double Deck (104 kartu)</strong> atau <strong>Single Deck (52 kartu)</strong>.
              </li>
            </ul>
          </div>

          {/* 5-Card Hand Rankings (Image Hierarchy) */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '10px' }}>
            <h4 style={{ color: '#fbbf24', fontWeight: 700, margin: '0 0 8px 0' }}>
              2. Tingkatan Kombinasi 5 Kartu (Hand Rankings)
            </h4>
            <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
              Jika meja dibuka dengan kombinasi 5 kartu, pemain berikutnya harus mengeluarkan kombinasi 5 kartu yang lebih tinggi sesuai hierarki berikut:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '6px' }}>
                <strong>1. ROYAL FLUSH</strong>
                <span style={{ color: '#fbbf24' }}>10-J-Q-K-As satu suit (Kombinasi Tertinggi)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px' }}>
                <strong>2. STRAIGHT FLUSH</strong>
                <span>5 kartu berurutan satu suit (misal 7♠ 8♠ 9♠ 10♠ J♠)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(2, 132, 199, 0.15)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <strong>3. FOUR OF A KIND</strong>
                <span style={{ color: '#38bdf8' }}>4 kartu angka kembar + 1 kartu buangan (misal 9-9-9-9 + K)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px' }}>
                <strong>4. FULL HOUSE</strong>
                <span>3 kartu angka kembar + 1 Pair (misal As-As-As + 3-3)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px' }}>
                <strong>5. FLUSH</strong>
                <span>5 kartu suit sama acak (misal 5 kartu Keriting ♣)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px' }}>
                <strong>6. STRAIGHT</strong>
                <span>5 kartu berurutan suit berbeda (misal 6-7-8-9-10)</span>
              </div>
            </div>
          </div>

          {/* Gameplay Flow */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '10px' }}>
            <h4 style={{ color: '#34d399', fontWeight: 700, margin: '0 0 6px 0' }}>
              3. Alur Permainan & Menang
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>
                <strong>Pembuka Ronde Pertama:</strong> Pemain pemegang kartu terendah (3♦) wajib memulai permainan dan wajib menyertakan kartu 3♦ tersebut di dalam kombinasi pertamanya.
              </li>
              <li>
                <strong>Kesesuaian Jumlah Kartu:</strong> Pemain berikutnya harus mengeluarkan kombinasi dengan <strong>jumlah kartu yang sama</strong> (Single lawan Single, Pair lawan Pair, Triple lawan Triple, 5 Kartu lawan 5 Kartu) dengan nilai lebih tinggi.
              </li>
              <li>
                <strong>Giliran Bebas (Free Turn):</strong> Jika semua pemain lain menekan <strong>Lewat (Pass)</strong>, meja dibersihkan dan pemain terakhir yang mengeluarkan kartu berhak memulai dengan kombinasi apa pun secara bebas!
              </li>
              <li>
                <strong>Pemenang:</strong> Pemain yang pertama kali menghabiskan seluruh kartu di tangannya dinyatakan sebagai <strong>PEMENANG (Juara 1)</strong>.
              </li>
            </ul>
          </div>

          {/* Scoring System */}
          <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '12px 16px', borderRadius: '10px' }}>
            <h4 style={{ color: '#38bdf8', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏆</span> 4. Sistem Skoring Poin (Urutan Tercepat Menghabiskan Kartu)
            </h4>
            <p style={{ margin: '0 0 8px 0' }}>
              Sistem skoring dihitung <strong>murni berdasarkan urutan tercepat menghabiskan kartu di tangan</strong> (<em>You get more points by finishing your hand the fastest!</em>), bukan dari jumlah sisa kartu.
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
              Poin Tambahan = Jumlah pemain yang masih tersisa di meja − 1
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Jika dimainkan oleh <strong>N pemain</strong>, pemain yang selesai pada urutan ke-<em>k</em> akan mendapatkan <strong>(N − k) poin</strong>:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', fontSize: '0.8rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px' }}>
                <strong style={{ color: '#fbbf24' }}>Juara 1</strong>: +(N − 1) Poin
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px' }}>
                <strong style={{ color: '#94a3b8' }}>Juara 2</strong>: +(N − 2) Poin
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px' }}>
                <strong style={{ color: '#b45309' }}>Juara 3</strong>: +(N − 3) Poin
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: '6px' }}>
                <strong style={{ color: '#f87171' }}>Terakhir</strong>: 0 Poin
              </div>
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn-primary" onClick={onClose} style={{ minWidth: '130px' }}>
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
