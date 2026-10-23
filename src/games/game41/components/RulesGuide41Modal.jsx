import React from 'react';
import { X, BookOpen, Award, ArrowRight, ShieldCheck, Flame } from 'lucide-react';

export default function RulesGuide41Modal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} className="text-gold" />
            <h3 style={{ margin: 0 }}>Panduan Resmi: Game Kartu 41 (Remi 41)</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body rules-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Target */}
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
            <h4 style={{ color: '#fbbf24', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={16} /> TUJUAN PERMAINAN
            </h4>
            <p style={{ margin: 0, color: '#fef3c7', fontSize: '0.875rem' }}>
              Kumpulkan <strong>4 kartu dengan lambang/suit yang sama</strong> (semua ♠ Sekop, ♥ Hati, ♦ Wajik, atau ♣ Keriting) dengan total nilai mendekati atau tepat bernilai <strong>41 poin</strong>!
            </p>
          </div>

          {/* Nilai Kartu */}
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
            <h4 style={{ color: '#60a5fa', margin: '0 0 6px 0' }}>
              🔢 NILAI KARTU
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#bfdbfe', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <li><strong>Kartu As (A)</strong> = <strong>11 poin</strong></li>
              <li><strong>Kartu Gambar (J, Q, K) dan Angka 10</strong> = masing-masing <strong>10 poin</strong></li>
              <li><strong>Kartu Angka (2 s/d 9)</strong> = bernilai sesuai angkanya (2=2, 3=3, dst.)</li>
              <li>
                <strong style={{ color: '#fbbf24' }}>Kombinasi 41 Murni:</strong> As (11) + tiga kartu bernilai 10 (contoh: A♠ + K♠ + Q♠ + J♠) = <strong>41 poin</strong>!
              </li>
            </ul>
          </div>

          {/* Alur Giliran Permainan */}
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
            <h4 style={{ color: '#34d399', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight size={16} /> ALUR GILIRAN PERMAINAN
            </h4>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#a7f3d0', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <li>
                <strong>Ambil Kartu:</strong> Pada giliran Anda, Anda dapat memilih:
                <br />• <strong>Ambil Dek Tertutup:</strong> Mengambil 1 kartu baru dari tumpukan dek.
                <br />• <strong>Ambil Buangan Teman:</strong> Mengambil kartu buangan yang dioper khusus oleh pemain sebelum Anda!
                <br /><em>(Jumlah kartu di tangan Anda menjadi 5 kartu).</em>
              </li>
              <li>
                <strong>Buang 1 Kartu ke Pemain Berikutnya:</strong> Pilih 1 kartu di tangan Anda yang tidak diinginkan untuk <strong>dibuang/dioper langsung ke pemain berikutnya</strong>.
                <br /><em>(Jumlah kartu kembali menjadi 4. Pemain berikutnya kemudian bebas memilih mengambil kartu buangan Anda atau ambil dari dek).</em>
              </li>
            </ol>
          </div>

          {/* Fitur Tutup Kartu & Penalti */}
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
            <h4 style={{ color: '#fbbf24', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> FITUR TUTUP KARTU & PENALTI
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#fef3c7', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <li>
                <strong>Tutup Kapan Saja:</strong> Kapanpun pemain siap pada gilirannya, pemain dapat menekan tombol <strong>Tutup Kartu</strong>.
              </li>
              <li>
                <strong>Aturan Penalti Terbawah:</strong> Jika Pemain A menutup kartu misal dengan <strong>30 poin</strong>, lalu ada Pemain B yang memiliki poin <strong>di atas 30 poin</strong>, maka:
                <br />• <strong>Pemain A otomatis KALAH</strong> dan ditempatkan di <strong>peringkat paling bawah</strong>.
                <br />• <strong>Pemain B menang</strong> sebagai juara 1.
                <br />• Pemain lain (misal Pemain C dengan 20 poin) <strong>tetap menang dan berada di atas Pemain A</strong>!
              </li>
              <li>
                <strong>Sukses Tutup Kartu:</strong> Jika tidak ada pemain lain yang melampaui poin penutup kartu, penutup kartu langsung menjadi Juara 1!
              </li>
            </ul>
          </div>

          {/* Riwayat Kartu yang Dibuang ke Anda (Rahasia) */}
          <div style={{ background: 'rgba(139, 92, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #8b5cf6' }}>
            <h4 style={{ color: '#a78bfa', margin: '0 0 6px 0' }}>
              🔒 RIWAYAT KARTU YANG DIBUANG KE ANDA (RAHASIA)
            </h4>
            <p style={{ margin: 0, color: '#ddd6fe', fontSize: '0.85rem', lineHeight: '1.6' }}>
              Setiap kali pemain sebelum Anda membuang kartu ke arah Anda, kartu tersebut otomatis tercatat pada panel <strong>"Dibuang ke Saya"</strong>. Riwayat ini <strong>bersifat rahasia dan hanya dapat dilihat oleh Anda sendiri</strong>, lengkap dengan catatan apakah kartu tersebut Anda ambil ke tangan atau Anda lewati.
            </p>
          </div>

          {/* Kemenangan & Skor */}
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
            <h4 style={{ color: '#f87171', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={16} /> KEMENANGAN & SKOR AKHIR
            </h4>
            <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.85rem', lineHeight: '1.6' }}>
              • <strong>Instant Win (41 Murni):</strong> Jika saat buang kartu Anda mencapai tepat 41 poin dari 1 suit yang sama, Anda menang seketika!<br />
              • <strong>Tutup Kartu / Dek Habis:</strong> Pemenang ditentukan oleh skor tertinggi dengan rumus:<br />
              <em>Skor = (Poin Suit Terbanyak) - (Poin Kartu Beda Suit)</em>.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-header btn-gold" onClick={onClose}>
            Saya Siap Bermain
          </button>
        </div>
      </div>
    </div>
  );
}
