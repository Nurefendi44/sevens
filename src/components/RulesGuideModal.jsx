import React from 'react';
import { BookOpen, X, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function RulesGuideModal({ onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen color="#fbbf24" size={20} />
            <h2 className="modal-title">BUKU ATURAN RESMI — GAME SEVENS</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          {/* Deck & Players */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: '8px' }}>
            <h4 style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}>
              Deck & Pembagian Kartu
            </h4>
            <p>
              Menggunakan deck standar 52 kartu (♠ Sekop, ♥ Hati, ♦ Wajik, ♣ Keriting).
              Dimainkan oleh 4 pemain lokal, masing-masing mendapatkan tepat 13 kartu.
            </p>
          </div>

          {/* Rule 1 */}
          <div>
            <h4 style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> RULE 1 — 7 SEKOP WAJIB MEMULAI
            </h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              Pemain yang memegang kartu <strong>7 Sekop (7♠)</strong> WAJIB menjadi pemain pertama dan WAJIB memainkan 7♠ pada giliran pertamanya.
              Tidak boleh memainkan kartu lain. Setelah 7♠ ditaruh di meja, giliran berjalan <strong>searah jarum jam</strong>.
            </p>
          </div>

          {/* Rule 2 */}
          <div>
            <h4 style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> RULE 2 — RANGKAIAN KARTU
            </h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              Setiap suit memiliki jalurnya sendiri: <code>A - 2 - 3 - 4 - 5 - 6 - 7 - 8 - 9 - 10 - J - Q - K</code>.<br/>
              Setelah 7 terbuka, kartu yang bisa dimainkan di sekitarnya adalah <strong>6 atau 8</strong> dari suit tersebut.
              Jika 6 sudah turun, berikutnya 5. Jika 8 sudah turun, berikutnya 9, dan seterusnya.
              Kartu 7 dari suit lain (♥, ♦, ♣) dapat dimainkan kapan saja untuk membuka rangkaian suit masing-masing.
            </p>
          </div>

          {/* Rule 3 */}
          <div>
            <h4 style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> RULE 3 — CLOSE / MENUTUP KARTU & CLOSURE DIRECTION
            </h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              Jika seorang pemain <strong>TIDAK MEMILIKI kartu wajib yang bisa dimainkan</strong> pada gilirannya (kartu 2..K atau 7), pemain <strong>BOLEH MENUTUP (CLOSE) SATU KARTU BEBAS</strong> dari tangannya. Kartu ini diletakkan tertutup face-down.
              <br />
              <em>*Catatan: Mengeluarkan kartu As untuk menutup rangkaian bersifat <strong>OPSIONAL</strong> (tidak wajib). Pemain tidak dipaksa menutup rangkaian dan bebas menyimpan kartu As untuk ronde berikutnya tanpa terkena FAULT.</em>
            </p>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '8px 12px', marginTop: '6px' }}>
              <strong style={{ color: '#93c5fd' }}>🔒 Tutup Rangkai As di Meja (Arah Global):</strong>
              <br />
              Saat suatu suit dirangkai di meja dan pemain <strong>mengeluarkan kartu As</strong>, terjadi penutupan rangkaian (Tutup Rangkai):
              <br />
              • Jika suit sudah lengkap <strong>2 hingga King</strong> saat pertama kali ditutup, pemain yang memainkan As dapat <strong>memilih mau Tutup Atas atau Tutup Bawah</strong>!
              <br />
              • <strong>Tutup Rangkai ATAS</strong> (As dimainkan di ujung King):
              <br />
              &nbsp;&nbsp;- Arah As global terkunci ke <strong>ATAS</strong> (suit lain hanya boleh As di atas).
              <br />
              &nbsp;&nbsp;- Kartu As yang ditutup telungkup dinilai <strong>-11</strong>.
              <br />
              &nbsp;&nbsp;- Pemain yang masih memegang kartu <strong>6</strong> dari suit tersebut terkena penalti <strong>-60</strong>!
              <br />
              &nbsp;&nbsp;- Rangkaian suit tersebut langsung <strong>selesai &amp; terkunci</strong> (kartu 5, 4, 3, 2 tidak bisa dimainkan lagi ke meja, namun bisa disimpan dan digunakan untuk kartu tutup jika macet).
              <br /><br />
              • <strong>Tutup Rangkai BAWAH</strong> (As dimainkan di ujung 2):
              <br />
              &nbsp;&nbsp;- Arah As global terkunci ke <strong>BAWAH</strong> (suit lain hanya boleh As di bawah).
              <br />
              &nbsp;&nbsp;- Kartu As yang ditutup telungkup dinilai <strong>-1</strong>.
              <br />
              &nbsp;&nbsp;- Pemain yang masih memegang kartu <strong>8</strong> dari suit tersebut terkena penalti <strong>-80</strong>!
              <br />
              &nbsp;&nbsp;- Rangkaian suit tersebut selesai &amp; terkunci (kartu 8..K tidak bisa dimainkan lagi ke meja).
            </div>
          </div>

          {/* Rule 4 */}
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
            <h4 style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} /> RULE 4 — CLOSE SAAT ADA KARTU WAJIB = FAULT
            </h4>
            <p style={{ color: '#fca5a5' }}>
              Jika pemain <strong>MASIH MEMILIKI kartu wajib (kartu 2..K atau 7) yang bisa dimainkan</strong> di meja, pemain DILARANG KERAS melakukan CLOSE.
              Tindakan ini divalidasi langsung oleh Game Engine dan dicatat sebagai <strong>FAULT</strong>.
            </p>
          </div>

          {/* Rule 5 */}
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
            <h4 style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> RULE 5 — KARTU 7 SEBAGAI PILIHAN TERAKHIR
            </h4>
            <p style={{ color: '#fef3c7' }}>
              Jika pemain memiliki kartu 7 yang valid dan kartu tersebut menjadi pilihan valid terakhirnya, pemain <strong>WAJIB memainkan kartu 7 tersebut</strong>. Dilarang menghindar dengan menutup kartu lain.
            </p>
          </div>

          {/* Rule 6 */}
          <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
            <h4 style={{ color: '#c084fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ RULE 6 — PENALTI KARTU 6 (-60) DAN 8 (-80)
            </h4>
            <p style={{ color: '#e9d5ff' }}>
              Pemain yang menahan/menyimpan kartu pembuka jalur (6 atau 8) hingga suit tersebut ditutup oleh kartu As di meja terkena sanksi berat:
              <br />
              • Memegang kartu 6 saat Tutup Rangkai Atas = <strong>MINUS 60</strong> (-60)
              <br />
              • Memegang kartu 8 saat Tutup Rangkai Bawah = <strong>MINUS 80</strong> (-80)
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-header btn-gold" onClick={onClose}>
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
