import React, { useState } from 'react';
import { 
  FileText, Search, Plus, 
  CheckCircle, XCircle, Clock,
  Eye, Download, Filter
} from 'lucide-react';

interface LetterRequest {
  id: string;
  nomor: string;
  warga: string;
  jenis: string;
  tanggal: string;
  status: 'Pending' | 'Disetujui' | 'Ditolak';
}

const MOCK_REQUESTS: LetterRequest[] = [
  { id: '1', nomor: 'SRT/001/V/2024', warga: 'MUHAMMAD KEMAL AFRILIDZI', jenis: 'Surat Pengantar Domisili', tanggal: '2024-05-10', status: 'Pending' },
  { id: '2', nomor: 'SRT/002/V/2024', warga: 'Siti Aminah', jenis: 'Surat Keterangan Tidak Mampu', tanggal: '2024-05-12', status: 'Disetujui' },
  { id: '3', nomor: 'SRT/003/V/2024', warga: 'Budi Santoso', jenis: 'Surat Pengantar Nikah', tanggal: '2024-05-13', status: 'Ditolak' },
];

export default function SuratPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="page-container">
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-icon blue" style={{ width: 40, height: 40 }}><FileText size={20} /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>12</div>
            <div className="stat-label">Total Pengajuan</div>
          </div>
        </div>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-icon yellow" style={{ width: 40, height: 40 }}><Clock size={20} /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>5</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-icon green" style={{ width: 40, height: 40 }}><CheckCircle size={20} /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>7</div>
            <div className="stat-label">Disetujui</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Daftar Pengajuan Surat</h3>
          <button className="btn btn-primary">
            <Plus size={16} /> Buat Pengajuan
          </button>
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Cari warga atau nomor surat..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="filter-select">
            <option value="">Semua Status</option>
            <option value="Pending">Pending</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
          </select>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nomor Surat</th>
                <th>Nama Warga</th>
                <th>Jenis Surat</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_REQUESTS.map((req) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 600, color: 'var(--blue-700)', fontSize: 13 }}>{req.nomor}</td>
                  <td>{req.warga}</td>
                  <td style={{ color: 'var(--gray-600)' }}>{req.jenis}</td>
                  <td>{req.tanggal}</td>
                  <td>
                    <span className={`badge ${
                      req.status === 'Disetujui' ? 'badge-active' : 
                      req.status === 'Ditolak' ? 'badge-danger' : 'badge-yellow'
                    }`} style={req.status === 'Pending' ? {background:'#fef9c3', color:'#a16207'} : req.status === 'Ditolak' ? {background:'#fee2e2', color:'#b91c1c'} : {}}>
                      {req.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" title="Lihat Detail"><Eye size={14} /></button>
                      {req.status === 'Pending' && (
                        <>
                          <button className="btn btn-primary btn-icon btn-sm" style={{ background: 'var(--green-500)' }} title="Setujui"><CheckCircle size={14} /></button>
                          <button className="btn btn-danger btn-icon btn-sm" title="Tolak"><XCircle size={14} /></button>
                        </>
                      )}
                      {req.status === 'Disetujui' && (
                        <button className="btn btn-secondary btn-icon btn-sm" title="Cetak PDF"><Download size={14} /></button>
                      )}
                    </div>
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
