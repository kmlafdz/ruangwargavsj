import React from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, 
  ArrowUpCircle, ArrowDownCircle,
  Search, Plus, Download, Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MOCK_FINANCE = [
  { id: '1', tanggal: '2024-05-01', ket: 'Iuran Bulanan RT 01', tipe: 'Masuk', kategori: 'Iuran', nominal: 1500000 },
  { id: '2', tanggal: '2024-05-03', ket: 'Perbaikan Lampu Jalan', tipe: 'Keluar', kategori: 'Pengeluaran', nominal: 450000 },
  { id: '3', tanggal: '2024-05-05', ket: 'Donasi Kegiatan Warga', tipe: 'Masuk', kategori: 'Donasi', nominal: 2000000 },
  { id: '4', tanggal: '2024-05-10', ket: 'Kebersihan Lingkungan', tipe: 'Keluar', kategori: 'Pengeluaran', nominal: 800000 },
];

const CHART_DATA = [
  { name: 'Jan', masuk: 4500, keluar: 2100 },
  { name: 'Feb', masuk: 5200, keluar: 3200 },
  { name: 'Mar', masuk: 4800, keluar: 4100 },
  { name: 'Apr', masuk: 6100, keluar: 2800 },
  { name: 'Mei', masuk: 5500, keluar: 1500 },
];

export default function KeuanganPage() {
  return (
    <div className="page-container">
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon blue"><Wallet size={22} /></div>
          <div>
            <div className="stat-value">Rp 15.420k</div>
            <div className="stat-label">Total Saldo Kas</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-value">Rp 5.500k</div>
            <div className="stat-label">Pemasukan Bulan Ini</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><TrendingDown size={22} /></div>
          <div>
            <div className="stat-value">Rp 1.250k</div>
            <div className="stat-label">Pengeluaran Bulan Ini</div>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Ikhtisar Arus Kas</h3>
            <p className="chart-subtitle">Perbandingan pemasukan dan pengeluaran per bulan</p>
          </div>
        </div>
        <div style={{ height: 250, width: '100%', marginTop: 20 }}>
          <ResponsiveContainer>
            <BarChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-100)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-md)' }} />
              <Bar dataKey="masuk" name="Pemasukan" fill="var(--blue-500)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="keluar" name="Pengeluaran" fill="var(--gray-300)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Riwayat Transaksi Terakhir</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary"><Download size={16} /> Laporan</button>
            <button className="btn btn-primary"><Plus size={16} /> Transaksi Baru</button>
          </div>
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Cari keterangan transaksi..." />
          </div>
          <select className="filter-select">
            <option value="">Semua Tipe</option>
            <option value="Masuk">Pemasukan</option>
            <option value="Keluar">Pengeluaran</option>
          </select>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Keterangan</th>
                <th>Kategori</th>
                <th>Nominal</th>
                <th>Tipe</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_FINANCE.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{item.tanggal}</td>
                  <td style={{ fontWeight: 600 }}>{item.ket}</td>
                  <td><span className="badge badge-inactive">{item.kategori}</span></td>
                  <td style={{ fontWeight: 700, color: item.tipe === 'Masuk' ? 'var(--green-700)' : 'var(--red-700)' }}>
                    {item.tipe === 'Masuk' ? '+' : '-'} Rp {item.nominal.toLocaleString('id-ID')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: item.tipe === 'Masuk' ? 'var(--green-700)' : 'var(--red-700)', fontSize: 12, fontWeight: 600 }}>
                      {item.tipe === 'Masuk' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                      {item.tipe}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm">Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
