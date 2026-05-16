import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Filter,
  Download, MoreVertical,
  Edit2, Trash2, Eye, MessageCircle,
  User as UserIcon, ShieldAlert, Loader2, CheckCircle2, History, ChevronRight
} from 'lucide-react';
import { User } from '../types';

import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

interface ResidentData {
  id: string;
  nik: string;
  nama: string;
  rt_id: string;
  jenisKelamin: string;
  tanggalLahir: string;
  nomorHP: string;
  role?: string;
  // Detail Fields
  noKK?: string;
  tempatLahir?: string;
  agama?: string;
  statusPerkawinan?: string;
  pekerjaan?: string;
  alamat?: string;
  blok?: string;
  nomorRumah?: string;
  rw_id?: string;
  statusValidasi?: 'Pending' | 'Terverifikasi' | 'Ditolak';
  lastViewedByAdmin?: any;
  dilihatAdmin?: boolean;
  matchScore?: number;
  facePhotoBase64?: string;
  history?: { date: any, action: string, user: string }[];
}

import { useNavigate } from 'react-router-dom';

export default function WargaPage() {
  const [residents, setResidents] = useState<ResidentData[]>([]);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [rtFilter, setRtFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('erw_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'residents'), orderBy('nama', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResidentData[];
      setResidents(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  // ROLE-BASED DATA ISOLATION
  const filteredResidents = residents.filter(res => {
    // 1. Filter by RT access (isolation)
    if (user?.role === 'rt' && res.rt_id !== user.rt_id) return false;

    // 2. Filter by Search
    const matchesSearch = res.nama.toLowerCase().includes(search.toLowerCase()) || res.nik.includes(search);

    // 3. Filter by RT Dropdown (for RW/Dev)
    const matchesRT = rtFilter === 'all' || res.rt_id === rtFilter;

    return matchesSearch && matchesRT;
  });


  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama: '',
    nik: '',
    rt_id: '',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '',
    tempatLahir: '',
    agama: 'ISLAM',
    statusPerkawinan: 'BELUM KAWIN',
    pekerjaan: '',
    nomorHP: '',
    role: 'warga'
  });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResident, setSelectedResident] = useState<ResidentData | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string, name: string, nik: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();

    // ROLE RESTRICTION VALIDATION
    const restrictedRoles = ['KETUA RW', 'KETUA RT 01', 'KETUA RT 02', 'KETUA RT 03', 'KETUA RT 04', 'KETUA RT 05'];
    if (restrictedRoles.includes(formData.role)) {
      try {
        const { getDocs, query, collection, where } = await import('firebase/firestore');
        const q = query(collection(db, 'residents'), where('role', '==', formData.role));
        const snap = await getDocs(q);

        // Cek jika ada warga lain (ID berbeda) yang sudah punya role ini
        const duplicate = snap.docs.find(d => d.id !== editingId);
        if (duplicate) {
          setErrorMessage(`Jabatan ${formData.role} sudah terisi oleh warga lain (${duplicate.data().nama}). Hanya diperbolehkan 1 orang per jabatan.`);
          setShowErrorModal(true);
          return;
        }
      } catch (e) {
        console.error("Validation error:", e);
      }
    }

    // NIK UNIQUENESS VALIDATION
    try {
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const q = query(collection(db, 'residents'), where('nik', '==', formData.nik));
      const snap = await getDocs(q);
      
      // Cek jika ada warga lain dengan NIK yang sama
      const duplicateNik = snap.docs.find(d => d.id !== editingId);
      if (duplicateNik) {
        setErrorMessage(`GAGAL: NIK ${formData.nik} sudah terdaftar atas nama ${duplicateNik.data().nama}. NIK tidak boleh ganda.`);
        setShowErrorModal(true);
        return;
      }
    } catch (e) {
      console.error("NIK Validation error:", e);
    }

    if (formData.nik.length !== 16) {
      setErrorMessage(`NIK WAJIB 16 DIGIT! Saat ini Anda memasukkan ${formData.nik.length} digit.`);
      setShowErrorModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const { addDoc, updateDoc, doc, collection, serverTimestamp } = await import('firebase/firestore');

      if (editingId) {
        await updateDoc(doc(db, 'residents', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        setSuccessMessage("Data warga berhasil diperbarui!");
      } else {
        await addDoc(collection(db, 'residents'), {
          ...formData,
          statusValidasi: 'Pending',
          createdAt: serverTimestamp()
        });
        setSuccessMessage("Data warga berhasil ditambahkan!");
      }

      const finalData = { ...formData };
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ 
        nama: '', nik: '', rt_id: '', jenisKelamin: 'Laki-laki', 
        tanggalLahir: '', tempatLahir: '', agama: 'ISLAM', 
        statusPerkawinan: 'BELUM KAWIN', pekerjaan: '', 
        nomorHP: '', role: 'warga' 
      });
      setShowSuccessModal(true);

      // SINKRONISASI ROLE KE KOLEKSI USERS & KIRIM WA
      try {
        const { createUserFromResident } = await import('../services/userService');
        await createUserFromResident({ ...finalData, fullName: finalData.nama }, finalData.role || 'warga');
        
        // Hanya kirim WA jika ini adalah warga BARU (bukan edit)
        if (!editingId && finalData.nomorHP) {
          const [y, m, d] = (finalData.tanggalLahir || '2000-01-01').split('-');
          const defaultPass = `${y}-${d}-${m}`;
          const waMsg = `Halo ${finalData.nama}, data Anda telah ditambahkan ke sistem Ruang Warga VSJ. Silakan lakukan verifikasi melalui aplikasi dengan NIK Anda sebagai username dan password default: ${defaultPass}. Anda wajib menyelesaikan registrasi data lengkap setelah login.`;
          
          const { sendWhatsAppMessage } = await import('../services/notificationService');
          await sendWhatsAppMessage(finalData.nomorHP, waMsg);
        }

      } catch (userErr) {
        console.error("Gagal sinkronisasi user:", userErr);
      }
    } catch (err: any) {
      setErrorMessage("Gagal memproses data: " + err.message);
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (res: ResidentData) => {
    setEditingId(res.id);
    setFormData({
      nama: res.nama,
      nik: res.nik,
      rt_id: res.rt_id,
      jenisKelamin: res.jenisKelamin,
      tanggalLahir: res.tanggalLahir || '',
      tempatLahir: res.tempatLahir || '',
      agama: res.agama || 'ISLAM',
      statusPerkawinan: res.statusPerkawinan || 'BELUM KAWIN',
      pekerjaan: res.pekerjaan || '',
      nomorHP: res.nomorHP || '',
      role: res.role || 'warga'
    });
    setShowAddModal(true);
  };

  const openDeleteConfirm = (id: string, name: string, nik: string) => {
    setDeletingItem({ id, name, nik });
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!deletingItem) return;
    setIsSubmitting(true);
    try {
      const { deleteUser } = await import('../services/userService');
      
      // Use the service to delete both user and resident (it matches by NIK)
      await deleteUser(deletingItem.nik);

      setShowDeleteConfirm(false);
      setDeletingItem(null);
      setSuccessMessage("Data warga dan kredensial login berhasil dihapus!");
      setShowSuccessModal(true);
    } catch (err: any) {
      setErrorMessage("Gagal menghapus: " + err.message);
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {user?.role === 'rt' && (
        <div style={{ marginBottom: 20, padding: 12, background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--green-800)' }}>
          <ShieldAlert size={18} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Mode Terisolasi: Menampilkan warga khusus wilayah RT {user.rt_id}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <h3 className="card-title" style={{ minWidth: '200px', flex: 1 }}>Daftar Warga RW 011</h3>
          <div className="mobile-actions" style={{ display: 'flex', gap: 10, width: 'auto' }}>
            <button className="btn btn-secondary btn-sm">
              <Download size={16} /> <span className="hide-mobile">Ekspor</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { 
              setEditingId(null); 
              setFormData({ 
                nama: '', nik: '', rt_id: '', jenisKelamin: 'Laki-laki', 
                tanggalLahir: '', tempatLahir: '', agama: 'ISLAM', 
                statusPerkawinan: 'BELUM KAWIN', pekerjaan: '', 
                nomorHP: '', role: 'warga' 
              }); 
              setShowAddModal(true); 
            }}>
              <Plus size={16} /> Tambah Warga
            </button>
          </div>
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Cari berdasarkan NIK atau Nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {user?.role !== 'rt' && (
              <select className="filter-select" value={rtFilter} onChange={e => setRtFilter(e.target.value)}>
                <option value="all">Semua RT</option>
                <option value="001">RT 001</option>
                <option value="002">RT 002</option>
                <option value="003">RT 003</option>
                <option value="004">RT 004</option>
                <option value="005">RT 005</option>
              </select>
            )}
            <select className="filter-select">
              <option value="">Semua Status</option>
              <option value="Tetap">Warga Tetap</option>
              <option value="Kontrak">Warga Kontrak</option>
            </select>
          </div>
        </div>

        <div className="table-responsive hide-mobile">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Nama Lengkap</th>
                <th>NIK</th>
                <th>RT</th>
                <th>Jenis Kelamin</th>
                <th>Role</th>
                <th>Nomor Telepon</th>
                <th style={{ textAlign: 'center' }}>Status Validasi</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredResidents.length > 0 ? filteredResidents.map((res) => (
                <tr key={res.id}>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 11, background: 'var(--blue-50)', color: 'var(--blue-600)' }}>
                        {res.nama.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{res.nama}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--gray-600)' }}>{res.nik}</td>
                  <td><span style={{ fontWeight: 600 }}>RT {res.rt_id}</span></td>
                  <td>{res.jenisKelamin}</td>
                  <td>
                    <span className="badge" style={{
                      background: res.role && res.role.startsWith('KETUA') ? 'var(--blue-50)' : 'var(--gray-50)',
                      color: res.role && res.role.startsWith('KETUA') ? 'var(--blue-600)' : 'var(--gray-500)',
                      fontWeight: 700,
                      fontSize: 10
                    }}>
                      {(res.role || 'warga').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{res.nomorHP || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge" style={{ 
                      background: res.statusValidasi === 'Terverifikasi' ? '#dcfce7' : '#fef9c3',
                      color: res.statusValidasi === 'Terverifikasi' ? '#15803d' : '#a16207',
                      padding: '4px 12px',
                      borderRadius: '50px',
                      fontWeight: 700,
                      fontSize: '11px',
                      display: 'inline-block'
                    }}>
                      {res.statusValidasi === 'Terverifikasi' ? 'TERVERIFIKASI' : 'MENUNGGU'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button 
                        className="btn btn-secondary btn-icon btn-sm" 
                        title="Detail"
                        onClick={() => { setSelectedResident(res); setShowDetailModal(true); }}
                      >
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-secondary btn-icon btn-sm" title="Edit" onClick={() => handleEdit(res)}><Edit2 size={14} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" title="Hapus" onClick={() => openDeleteConfirm(res.id, res.nama, res.nik)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                    Tidak ada data warga yang sesuai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW CARDS */}
        <div className="show-mobile">
          {filteredResidents.length > 0 ? filteredResidents.map((res) => (
            <div key={res.id} className="card shadow-sm" style={{ marginBottom: 12, padding: 16, border: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="admin-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
                    {res.nama.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--gray-800)', fontSize: 14 }}>{res.nama}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>{res.nik}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, padding: '10px 0', borderTop: '1px dashed var(--gray-100)', borderBottom: '1px dashed var(--gray-100)' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Wilayah</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>RT {res.rt_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Nomor HP</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{res.nomorHP || '-'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setSelectedResident(res); setShowDetailModal(true); }}><Eye size={14} /> Detail</button>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleEdit(res)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-danger btn-icon btn-sm" onClick={() => openDeleteConfirm(res.id, res.nama, res.nik)}><Trash2 size={16} /></button>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
              Data tidak ditemukan.
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="card fade-in shadow-xl modal-mobile-fix" style={{ maxWidth: 540, borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 16px', borderBottom: '1px solid var(--gray-100)' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)' }}>{editingId ? 'Edit Data Warga' : 'Tambah Warga Baru'}</h2>
              <button className="close-btn" onClick={() => { setShowAddModal(false); setEditingId(null); }}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <form onSubmit={handleAddResident} className="form-grid">
                <div className="form-group full">
                  <label>Nama Lengkap</label>
                  <input
                    className="form-input"
                    required
                    style={{ textTransform: 'uppercase' }}
                    value={formData.nama}
                    onChange={e => setFormData({ ...formData, nama: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group">
                  <label>NIK (Wajib 16 Digit Angka)</label>
                  <input
                    className="form-input"
                    required
                    minLength={16}
                    maxLength={16}
                    pattern="[0-9]{16}"
                    title="NIK harus berupa 16 digit angka"
                    value={formData.nik}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, nik: val });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Nomor RT</label>
                  <select className="form-input" required value={formData.rt_id} onChange={e => setFormData({ ...formData, rt_id: e.target.value })}>
                    <option value="">Pilih RT</option>
                    <option value="001">RT 001</option>
                    <option value="002">RT 002</option>
                    <option value="003">RT 003</option>
                    <option value="004">RT 004</option>
                    <option value="005">RT 005</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Tanggal Lahir</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required
                    value={formData.tanggalLahir} 
                    onChange={e => setFormData({ ...formData, tanggalLahir: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Jenis Kelamin</label>
                  <select className="form-input" value={formData.jenisKelamin} onChange={e => setFormData({ ...formData, jenisKelamin: e.target.value })}>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Tempat Lahir</label>
                  <input
                    className="form-input"
                    placeholder="Contoh: JAKARTA"
                    value={formData.tempatLahir}
                    onChange={e => setFormData({ ...formData, tempatLahir: e.target.value.toUpperCase() })}
                    list="warga-cities-list"
                  />
                  <datalist id="warga-cities-list">
                    {['JAKARTA', 'SURABAYA', 'BANDUNG', 'MEDAN', 'BEKASI', 'TANGERANG', 'DEPOK', 'SEMARANG', 'PALEMBANG', 'MAKASSAR', 'TANGERANG SELATAN', 'BOGOR', 'BATAM', 'PEKANBARU', 'BANDAR LAMPUNG', 'MALANG', 'PADANG', 'DENPASAR', 'SAMARINDA', 'TASIKMALAYA', 'BANJARMASIN', 'BALIKPAPAN', 'PONTIANAK', 'CIMAHI', 'JAMBI', 'SURAKARTA', 'MANADO', 'MATARAM', 'CILEGON', 'PALU', 'KUPANG', 'SUKABUMI', 'BENGKULU', 'CIREBON', 'PEKALONGAN', 'AMBON', 'TEGAL', 'BINJAI', 'PURWOKERTO', 'LUBUKLINGGAU', 'PEMATANGSIANTAR', 'LOA JANAN', 'BANDA ACEH', 'TARAKAN', 'SINGKAWANG', 'PROBOLINGGO', 'BITUNG', 'BANJARBARU', 'TEBING TINGGI', 'PANGKALPINANG', 'LHOKSEUMAWE', 'SORONG', 'MADIUN', 'SALATIGA', 'KEDIRI', 'PAGAR ALAM', 'SINGARAJA', 'GORONTALO', 'BUKITTINGGI', 'KENDARI', 'PADANG SIDEMPUAN', 'TUAL', 'PAREPARE', 'BONTANG', 'TANJUNGPINANG', 'TERNATE', 'PALOPO', 'SOLOK'].map(city => <option key={city} value={city} />)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Agama</label>
                  <select className="form-input" value={formData.agama} onChange={e => setFormData({ ...formData, agama: e.target.value })}>
                    <option value="ISLAM">ISLAM</option>
                    <option value="KRISTEN">KRISTEN</option>
                    <option value="KATOLIK">KATOLIK</option>
                    <option value="HINDU">HINDU</option>
                    <option value="BUDHA">BUDHA</option>
                    <option value="KONGHUCU">KONGHUCU</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status Perkawinan</label>
                  <select className="form-input" value={formData.statusPerkawinan} onChange={e => setFormData({ ...formData, statusPerkawinan: e.target.value })}>
                    <option value="BELUM KAWIN">BELUM KAWIN</option>
                    <option value="KAWIN">KAWIN</option>
                    <option value="CERAI HIDUP">CERAI HIDUP</option>
                    <option value="CERAI MATI">CERAI MATI</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Pekerjaan</label>
                  <input
                    className="form-input"
                    placeholder="Contoh: KARYAWAN SWASTA"
                    style={{ textTransform: 'uppercase' }}
                    value={formData.pekerjaan}
                    onChange={e => setFormData({ ...formData, pekerjaan: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group">
                  <label>Nomor Telepon / WA</label>
                  <input
                    className="form-input"
                    placeholder="Contoh: 0812..."
                    value={formData.nomorHP}
                    onChange={e => setFormData({ ...formData, nomorHP: e.target.value })}
                  />
                </div>

                <div className="form-group full">
                  <label>Hak Akses / Role User</label>
                  <select
                    className="form-input"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-200)', fontWeight: 600 }}
                  >
                    <option value="warga">Warga (Default)</option>
                    <option value="KETUA RW">Ketua RW</option>
                    <option value="developer">Developer</option>
                    <option disabled>──────────</option>
                    <option value="KETUA RT 01">Ketua RT 01</option>
                    <option value="KETUA RT 02">Ketua RT 02</option>
                    <option value="KETUA RT 03">Ketua RT 03</option>
                    <option value="KETUA RT 04">Ketua RT 04</option>
                    <option value="KETUA RT 05">Ketua RT 05</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                    *Memilih role selain Warga akan otomatis membuat/memperbarui akun login untuk NIK ini.
                  </p>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="spin" size={18} /> : 'Simpan Data'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* CUSTOM DELETE CONFIRM MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="card fade-in shadow-xl" style={{ maxWidth: 400, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>Konfirmasi Hapus</h3>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 24 }}>
              Apakah Anda yakin ingin menghapus data warga <br />
              <strong style={{ color: 'var(--gray-800)' }}>{deletingItem?.name}</strong>? <br />
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>Batal</button>
              <button className="btn btn-danger" style={{ flex: 1.5 }} onClick={executeDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="spin" size={18} /> : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CUSTOM SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="card fade-in shadow-xl" style={{ maxWidth: 360, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'var(--green-50)', color: 'var(--green-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>Berhasil!</h3>
            <p style={{ fontSize: 15, color: 'var(--gray-500)', marginBottom: 28, lineHeight: 1.5 }}>{successMessage}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {successMessage.includes('ditambahkan') && (
                <button
                  className="btn btn-secondary btn-block"
                  style={{ padding: '12px', fontSize: '14px', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => {
                    const resident = residents.find(r => r.nik === successMessage.match(/\d{16}/)?.[0]) || residents[residents.length-1];
                    if (resident?.nomorHP) {
                      const [y, m, d] = (resident.tanggalLahir || '2000-01-01').split('-');
                      const defaultPass = `${y}-${d}-${m}`;
                      const msg = `Halo ${resident.nama},\n\nSelamat! Data Anda telah terdaftar di sistem Ruang Warga VSJ VSJ. Silakan login untuk melakukan aktivasi akun menggunakan kredensial berikut:\n\n🌐 Link: https://ruangwarga011.com\n👤 Username: ${resident.nik}\n🔑 Password: ${defaultPass}\n\nMohon segera lengkapi data KTP & KK setelah login. Terima kasih!`;
                      window.open(`https://wa.me/62${resident.nomorHP.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }
                  }}
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width={16} height={16} alt="WA" /> Kirim Pesan WhatsApp
                </button>
              )}
              
              <button
                className="btn btn-primary btn-block"
                style={{ padding: '14px', fontSize: '15px', fontWeight: 700, borderRadius: '12px' }}
                onClick={() => setShowSuccessModal(false)}
              >
                Tutup & Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ERROR MODAL */}
      {showErrorModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="card fade-in shadow-xl" style={{ maxWidth: 400, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <ShieldAlert size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>Peringatan!</h3>
            <p style={{ fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 28 }}>{errorMessage}</p>
            <button
              className="btn btn-danger-solid btn-block"
              style={{ padding: '14px', fontSize: '15px', fontWeight: 700, borderRadius: '12px' }}
              onClick={() => setShowErrorModal(false)}
            >
              Konfirmasi
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM DETAIL MODAL */}
      {showDetailModal && selectedResident && (
        <div className="modal-overlay" style={{ zIndex: 1150 }}>
          <div className="card fade-in shadow-xl modal-mobile-fix" style={{ maxWidth: 600, width: '100%', borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: 24, background: 'var(--blue-600)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Detail Informasi Warga</h3>
                <p style={{ fontSize: 12, opacity: 0.8 }}>NIK: {selectedResident.nik}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: 24 }}>
              {selectedResident.facePhotoBase64 && (
                <div style={{ textAlign: 'center', marginBottom: 24, padding: 16, background: 'var(--gray-50)', borderRadius: 20 }}>
                  <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 12px', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <img src={selectedResident.facePhotoBase64} alt="Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-600)', textTransform: 'uppercase', letterSpacing: 1 }}>Foto Verifikasi Wajah</p>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Nama Lengkap</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.nama}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>NIK</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.nik}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tempat Lahir</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.tempatLahir || '-'}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tanggal Lahir</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
                    {selectedResident.tanggalLahir ? new Date(selectedResident.tanggalLahir).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Jenis Kelamin</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.jenisKelamin}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Agama</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.agama || '-'}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Status Perkawinan</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.statusPerkawinan || '-'}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Pekerjaan</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.pekerjaan || '-'}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Nomor KK</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{selectedResident.noKK || '-'}</p>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Alamat KTP</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 }}>{selectedResident.alamat || '-'}</p>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Alamat Domisili Perumahan</label>
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 }}>
                    {selectedResident.blok ? `Blok ${selectedResident.blok}, Nomor ${selectedResident.nomorRumah}` : 'Data alamat perumahan tidak lengkap'}
                  </p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Wilayah RT / RW</label>
                  <p style={{ fontWeight: 700, color: 'var(--blue-700)' }}>RT {selectedResident.rt_id || '-'} / RW {selectedResident.rw_id || '011'}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Nomor HP</label>
                  <p style={{ fontWeight: 600, color: 'var(--blue-600)' }}>{selectedResident.nomorHP || '-'}</p>
                </div>
                <div className="detail-item">
                  <label style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Status Validasi</label>
                  <span className="badge" style={{ 
                    background: selectedResident.statusValidasi === 'Terverifikasi' ? '#dcfce7' : '#fef9c3',
                    color: selectedResident.statusValidasi === 'Terverifikasi' ? '#15803d' : '#a16207',
                    padding: '4px 12px',
                    borderRadius: '50px',
                    fontWeight: 700,
                    fontSize: '11px',
                    display: 'inline-block'
                  }}>
                    {selectedResident.statusValidasi === 'Terverifikasi' ? 'TERVERIFIKASI' : 'MENUNGGU'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--gray-100)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={16} /> Histori Perubahan Data
                </h4>
                {selectedResident.history && selectedResident.history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedResident.history.map((h, idx) => (
                      <div key={idx} style={{ fontSize: 12, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{h.action} oleh <span style={{ fontWeight: 600 }}>{h.user}</span></span>
                        <span style={{ color: 'var(--gray-500)' }}>
                          {h.date?.seconds ? new Date(h.date.seconds * 1000).toLocaleString('id-ID') : h.date}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Belum ada riwayat perubahan.</p>
                )}
              </div>
            </div>
            
            <div style={{ padding: 16, background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDetailModal(false)}>Tutup</button>
              
              {selectedResident.statusValidasi !== 'Terverifikasi' && (
                <>
                  <button 
                    className="btn" 
                    style={{ background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 12 }}
                    onClick={() => {
                      const msg = `Halo ${selectedResident.nama}, mohon segera melakukan verifikasi data lengkap Anda melalui aplikasi Ruang Warga VSJ agar akun Anda dapat segera kami aktifkan.`;
                      window.open(`https://wa.me/62${(selectedResident.nomorHP || '').replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    title="Kirim Pemberitahuan WhatsApp"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 2 }}
                    onClick={() => {
                      setShowDetailModal(false);
                      navigate('/admin/approvals'); 
                    }}
                  >
                    Tinjau di Halaman Persetujuan Warga
                  </button>
                </>
              )}
              {selectedResident.statusValidasi === 'Terverifikasi' && (
                <button className="btn btn-primary-solid" style={{ flex: 1 }} onClick={() => { setShowDetailModal(false); handleEdit(selectedResident); }}>Edit Data</button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function DetailItem({ label, value, isBadge }: { label: string, value: string, isBadge?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {isBadge ? (
        <span className="badge badge-blue" style={{ fontSize: 11 }}>{value}</span>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>{value}</div>
      )}
    </div>
  );
}

function HistoryItem({ date, action, user }: { date: string, action: string, user: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', padding: '10px 14px', borderRadius: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{action}</div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Oleh: {user}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{date}</div>
    </div>
  );
}
