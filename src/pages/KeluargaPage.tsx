import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Eye, Edit2, Trash2,
  ChevronLeft, ChevronRight, Users, Home, UserCheck, Activity,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, deleteDoc, setDoc, collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import FamilyDetailView from '../components/FamilyDetailView';
import FamilyFormModal from '../components/FamilyFormModal';
import MemberFormModal from '../components/MemberFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const PAGE_SIZE = 5;

// ── Loading skeleton ──
function TableSkeleton() {
  return (
    <tbody>
      {[...Array(5)].map((_, i) => (
        <tr key={i}>
          {[...Array(8)].map((_, j) => (
            <td key={j}>
              <div style={{ height: 14, background: 'var(--gray-100)', borderRadius: 4, width: j === 1 ? 130 : j === 2 ? 100 : 60, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ── Stat Card ──
interface StatCardProps {
  icon: React.ReactNode;
  colorClass: string;
  value: string | number;
  label: string;
  change?: string;
  loading: boolean;
}

function StatCard({ icon, colorClass, value, label, change, loading }: StatCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className={`stat-card-premium ${colorClass}`}
    >
      <div className="stat-card-content">
        <div className="stat-icon-wrapper">{icon}</div>
        <div className="stat-data">
          {loading ? (
            <div className="skeleton-line" style={{ width: 60, height: 28, marginBottom: 4 }} />
          ) : (
            <div className="stat-value-premium">{value}</div>
          )}
          <div className="stat-label-premium">{label}</div>
        </div>
      </div>
      {change && !loading && (
        <div className="stat-trend">
          <TrendingUp size={12} /> {change}
        </div>
      )}
    </motion.div>
  );
}

// ── Detail wrapper ──
function DetailPane({ family, onBack, showToast }: { family: any; onBack: () => void; showToast: any }) {
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const handleSaveMember = async (data: any) => {
    try {
      const residentData = {
        nik: data.nik,
        nama: data.namaLengkap,
        jenisKelamin: data.jenisKelamin,
        tanggalLahir: data.tanggalLahir,
        tempatLahir: data.tempatLahir || '',
        agama: data.agama || 'ISLAM',
        nomorHP: data.noTelepon || '',
        hubungan: data.hubungan,
        statusPerkawinan: data.statusPerkawinan,
        pekerjaan: data.pekerjaan,
        alamat: data.alamat,
        noKK: family.nomorKK,
        updatedAt: new Date().toISOString()
      };

      if (data.id && !data.id.startsWith('nik-')) {
        // Edit existing
        await updateDoc(doc(db, 'residents', data.id), residentData);
      } else {
        // Create new
        const newRef = doc(collection(db, 'residents'));
        await setDoc(newRef, { ...residentData, createdAt: new Date().toISOString() });
      }

      // If this member is the new Head of Family, update the family doc
      if (data.hubungan === 'Kepala Keluarga') {
        await updateDoc(doc(db, 'families', family.id), {
          kepalaKeluarga: data.namaLengkap
        });
      }

      showToast(`Data ${data.namaLengkap} berhasil disimpan`);
      setShowMemberForm(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data anggota', 'error');
    }
  };

  const handleDeleteMember = async () => {
    try {
      await deleteDoc(doc(db, 'residents', confirmDelete.item.id));
      showToast('Anggota keluarga berhasil dihapus');
      setConfirmDelete(null);
    } catch (err) {
      showToast('Gagal menghapus anggota', 'error');
    }
  };

  return (
    <>
      {family && <FamilyDetailView
        family={family}
        members={family.members || []}
        onBack={onBack}
        onAddMember={() => { setEditingMember(null); setShowMemberForm(true); }}
        onEditMember={m => { setEditingMember(m); setShowMemberForm(true); }}
        onDeleteMember={m => setConfirmDelete({ item: m })}
      />}

      {showMemberForm && (
        <MemberFormModal
          member={editingMember}
          existingMembers={family.members || []}
          kkId={family?.id || ''}
          onSave={handleSaveMember}
          onClose={() => { setShowMemberForm(false); setEditingMember(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Hapus Anggota Keluarga?"
          message={`Hapus ${confirmDelete.item.nama || confirmDelete.item.namaLengkap} dari daftar keluarga?`}
          onConfirm={handleDeleteMember}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

// ── Main Page ──
export default function KeluargaPage() {
  const [familiesData, setFamiliesData] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRT, setFilterRT] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('list');
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);
  
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editingFamily, setEditingFamily] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  useEffect(() => {
    setLoading(true);
    // Fetch Families
    const qFamilies = query(collection(db, 'families'), orderBy('updatedAt', 'desc'));
    const unsubscribeFamilies = onSnapshot(qFamilies, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFamiliesData(data);
    });

    // Fetch Residents
    const qResidents = query(collection(db, 'residents'), orderBy('nama', 'asc'));
    const unsubscribeResidents = onSnapshot(qResidents, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResidents(data);
      setLoading(false);
    });

    return () => {
      unsubscribeFamilies();
      unsubscribeResidents();
    };
  }, []);

  // Group residents into families based on the real families collection
  const families = useMemo(() => {
    return familiesData.map(fam => {
      const members = residents.filter(res => res.noKK === fam.nomorKK);
      return {
        ...fam,
        members,
        jumlahAnggota: members.length
      };
    });
  }, [familiesData, residents]);

  const totalKK = families.length;
  const totalWarga = residents.length;
  const aktif = families.filter(f => (f.status || 'Aktif') === 'Aktif').length;

  // ── Filtered ──
  const filtered = useMemo(() => families.filter(f => {
    const q = search.toLowerCase();
    const matchQ = !q || f.nomorKK?.includes(q) || f.kepalaKeluarga?.toLowerCase().includes(q) || f.alamat?.toLowerCase().includes(q);
    const matchRT = !filterRT || f.rt === filterRT;
    const matchS = !filterStatus || (f.status || 'Aktif') === filterStatus;
    return matchQ && matchRT && matchS;
  }), [families, search, filterRT, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const goToPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  // ── Chart data ──
  const rtCounts = ['001', '002', '003', '004', '005'].map(rt => ({
    rt: `RT ${rt}`, warga: residents.filter(r => r.rt_id === rt).length
  }));

  const handleSaveFamily = async (data: any) => {
    try {
      const familyData = {
        nomorKK: data.nomorKK,
        kepalaKeluarga: data.kepalaKeluarga,
        alamat: data.alamat,
        rt: data.rt,
        rw: data.rw,
        status: data.status || 'Aktif',
        updatedAt: new Date().toISOString()
      };

      if (editingFamily?.id) {
        // 1. Update family doc
        await updateDoc(doc(db, 'families', editingFamily.id), familyData);

        // 2. Sync address to ALL residents with this noKK
        const membersToUpdate = residents.filter(r => r.noKK === editingFamily.nomorKK);
        const syncPromises = membersToUpdate.map(m => 
          updateDoc(doc(db, 'residents', m.id), { 
            alamat: data.alamat,
            rt: data.rt,
            rw: data.rw,
            updatedAt: new Date().toISOString()
          })
        );
        
        // 3. Sync head of family status
        const newHead = membersToUpdate.find(m => (m.nama || m.namaLengkap || m.fullName) === data.kepalaKeluarga);
        if (newHead && newHead.hubungan !== 'Kepala Keluarga') {
          syncPromises.push(updateDoc(doc(db, 'residents', newHead.id), { 
            hubungan: 'Kepala Keluarga',
            updatedAt: new Date().toISOString()
          }));
          
          const oldHead = membersToUpdate.find(m => m.hubungan === 'Kepala Keluarga' && m.id !== newHead.id);
          if (oldHead) {
            syncPromises.push(updateDoc(doc(db, 'residents', oldHead.id), { 
              hubungan: 'Lainnya',
              updatedAt: new Date().toISOString()
            }));
          }
        }

        await Promise.all(syncPromises);
      } else {
        await setDoc(doc(collection(db, 'families')), {
          ...familyData,
          createdAt: new Date().toISOString()
        });
      }
      showToast('Data Kartu Keluarga berhasil disimpan');
      setShowFamilyForm(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data KK', 'error');
    }
  };

  const handleDeleteFamily = async () => {
    try {
      await deleteDoc(doc(db, 'families', confirmDelete.item.id));
      showToast('Data Kartu Keluarga berhasil dihapus');
      setConfirmDelete(null);
    } catch (err) {
      showToast('Gagal menghapus data KK', 'error');
    }
  };

  const openDetail = (fam: any) => { setSelectedFamily(fam); setView('detail'); };
  const backToList = () => { setSelectedFamily(null); setView('list'); };

  const activeFamily = useMemo(() => {
    if (!selectedFamily?.id) return null;
    return families.find(f => f.id === selectedFamily.id);
  }, [families, selectedFamily?.id]);

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<Home size={22} />} colorClass="blue" value={totalKK} label="Total Kartu Keluarga" loading={loading} />
        <StatCard icon={<Users size={22} />} colorClass="green" value={totalWarga} label="Total Warga" loading={loading} />
        <StatCard icon={<UserCheck size={22} />} colorClass="yellow" value={totalKK} label="Kepala Keluarga" loading={loading} />
        <StatCard icon={<Activity size={22} />} colorClass="indigo" value={aktif} label="KK Aktif" loading={loading} />
      </div>

      <div className="chart-row-premium">
        <div className="card-premium chart-card">
          <div className="card-header-premium">
            <h3 className="card-title-premium">Demografi Warga per RT</h3>
            <div className="card-subtitle-premium">Distribusi populasi di wilayah RW 011</div>
          </div>
          <div className="card-body-premium" style={{ padding: 20 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rtCounts} barSize={32}>
                <XAxis dataKey="rt" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: 12 }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                />
                <Bar dataKey="warga" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-premium chart-card">
          <div className="card-header-premium">
            <h3 className="card-title-premium">Status Validasi KK</h3>
            <div className="card-subtitle-premium">Rasio keaktifan data keluarga</div>
          </div>
          <div className="card-body-premium" style={{ padding: 20 }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie 
                  data={[{ name: 'Aktif', value: aktif }, { name: 'Non-Aktif', value: Math.max(0, totalKK - aktif) }]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={8}
                >
                  <Cell fill="#3b82f6" stroke="none" />
                  <Cell fill="#f1f5f9" stroke="none" />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600, color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-premium">
        {view === 'list' ? (
          <>
            <div className="card-header-premium flex-between">
              <div>
                <h3 className="card-title-premium">Manajemen Kartu Keluarga</h3>
                <p className="card-subtitle-premium">Daftar lengkap KK terverifikasi di wilayah RW 011</p>
              </div>
            </div>

            <div className="toolbar-premium">
              <div className="search-wrapper-premium">
                <Search size={18} className="search-icon-premium" />
                <input 
                  placeholder="Cari No. KK, Kepala Keluarga, atau Alamat..."
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} 
                />
              </div>
              <div className="filters-premium">
                <select value={filterRT} onChange={e => { setFilterRT(e.target.value); setPage(1); }}>
                  <option value="">Semua RT</option>
                  {['001', '002', '003', '004', '005'].map(r => <option key={r} value={r}>RT {r}</option>)}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                  <option value="">Semua Status</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Non-Aktif">Non-Aktif</option>
                </select>
              </div>
            </div>

            <div className="table-container-premium">
              <table className="table-premium hide-on-mobile">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nomor Kartu Keluarga</th>
                    <th>Kepala Keluarga</th>
                    <th>Jumlah Anggota</th>
                    <th>Lokasi Rumah</th>
                    <th>RT/RW</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton /> : (
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                          <Users size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                          <p>Tidak ditemukan data Kartu Keluarga</p>
                        </td>
                      </tr>
                    ) : paginated.map((fam, idx) => (
                      <tr key={fam.id}>
                        <td><span className="row-number">{(page - 1) * PAGE_SIZE + idx + 1}</span></td>
                        <td>
                          <div className="kk-number-badge">
                            {fam.nomorKK}
                          </div>
                        </td>
                        <td><div className="cell-main-text">{fam.kepalaKeluarga}</div></td>
                        <td>
                          <div className="member-count-badge">
                            <Users size={12} /> {fam.jumlahAnggota || 0} Anggota
                          </div>
                        </td>
                        <td><div className="cell-sub-text" style={{ maxWidth: 200 }}>{fam.alamat}</div></td>
                        <td><div className="rt-rw-badge">RT {fam.rt} / 011</div></td>
                        <td>
                          <span className={`status-badge-premium ${fam.status === 'Non-Aktif' ? 'inactive' : 'active'}`}>
                            {fam.status || 'Aktif'}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons-premium">
                            <button className="action-btn-p secondary" onClick={() => openDetail(fam)} title="Detail"><Eye size={16} /></button>
                            <button className="action-btn-p primary" onClick={() => { setEditingFamily(fam); setShowFamilyForm(true); }} title="Edit"><Edit2 size={16} /></button>
                            <button className="action-btn-p danger" onClick={() => setConfirmDelete({ item: fam })} title="Hapus"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>

              {/* Mobile Card View */}
              <div className="mobile-family-cards hide-on-desktop">
                {loading ? <div className="p-20 center"><Activity className="spin" /></div> : (
                  paginated.length === 0 ? (
                    <div className="empty-mobile">Tidak ditemukan data</div>
                  ) : paginated.map((fam, idx) => (
                    <div className="mobile-kk-card" key={fam.id} onClick={() => openDetail(fam)}>
                      <div className="m-card-header">
                        <div className="m-kk-badge">{fam.nomorKK}</div>
                        <span className={`status-dot ${fam.status === 'Non-Aktif' ? 'inactive' : 'active'}`} />
                      </div>
                      <div className="m-card-body">
                        <div className="m-kepala">{fam.kepalaKeluarga}</div>
                        <div className="m-meta">
                          <span>RT {fam.rt} / 011</span>
                          <span>•</span>
                          <span>{fam.jumlahAnggota || 0} Anggota</span>
                        </div>
                        <div className="m-address">{fam.alamat}</div>
                      </div>
                      <div className="m-card-footer" onClick={e => e.stopPropagation()}>
                        <button className="m-action edit" onClick={() => { setEditingFamily(fam); setShowFamilyForm(true); }}><Edit2 size={14} /> EDIT</button>
                        <button className="m-action delete" onClick={() => setConfirmDelete({ item: fam })}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pagination-premium">
              <span className="pagination-info-premium">
                Menampilkan <b>{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</b> dari <b>{filtered.length}</b> data keluarga
              </span>
              <div className="pagination-controls-premium">
                <button className="p-control-btn" onClick={() => goToPage(page - 1)} disabled={page === 1}><ChevronLeft size={16} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`p-number-btn ${p === page ? 'active' : ''}`} onClick={() => goToPage(p)}>{p}</button>
                ))}
                <button className="p-control-btn" onClick={() => goToPage(page + 1)} disabled={page === totalPages}><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card-header">
              <div className="breadcrumb" style={{ margin: 0 }}>
                <span className="link" onClick={backToList}>Daftar KK</span>
                <span className="sep">›</span>
                <span>{activeFamily?.kepalaKeluarga}</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={backToList}><ChevronLeft size={14} /> Kembali</button>
            </div>
            <div className="card-body">
              <DetailPane family={activeFamily} onBack={backToList} showToast={showToast} />
            </div>
          </>
        )}
      </div>

      {showFamilyForm && (
        <FamilyFormModal 
          family={editingFamily} 
          allFamilies={families} 
          familyMembers={editingFamily ? residents.filter(r => r.noKK === editingFamily.nomorKK) : []}
          onSave={handleSaveFamily} 
          onClose={() => { setShowFamilyForm(false); setEditingFamily(null); }} 
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Hapus Kartu Keluarga?"
          message={`Data KK atas nama "${confirmDelete.item.kepalaKeluarga}" akan dihapus.`}
          onConfirm={handleDeleteFamily}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        .stat-card-premium {
          background: #fff;
          border-radius: 24px;
          padding: 24px;
          border: 1px solid #f1f5f9;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
          transition: all 0.3s ease;
        }
        .stat-card-premium::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 4px; height: 100%;
        }
        .stat-card-premium.blue::before { background: #3b82f6; }
        .stat-card-premium.green::before { background: #10b981; }
        .stat-card-premium.yellow::before { background: #f59e0b; }
        .stat-card-premium.indigo::before { background: #6366f1; }

        .stat-card-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .stat-icon-wrapper {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          color: #64748b;
        }
        .blue .stat-icon-wrapper { background: #eff6ff; color: #3b82f6; }
        .green .stat-icon-wrapper { background: #ecfdf5; color: #10b981; }
        .yellow .stat-icon-wrapper { background: #fffbeb; color: #f59e0b; }
        .indigo .stat-icon-wrapper { background: #f5f3ff; color: #6366f1; }

        .stat-value-premium {
          font-size: 28px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
        }
        .stat-label-premium {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin-top: 4px;
        }

        .chart-row-premium {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 20px;
          margin-bottom: 24px;
        }
        .card-premium {
          background: #fff;
          border-radius: 28px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          overflow: hidden;
        }
        .card-header-premium {
          padding: 24px 32px;
          border-bottom: 1px solid #f1f5f9;
        }
        .flex-between {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-title-premium {
          font-size: 18px;
          font-weight: 900;
          color: #1e3a8a;
          margin: 0;
        }
        .card-subtitle-premium {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }

        .toolbar-premium {
          padding: 20px 32px;
          display: flex;
          gap: 16px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }
        .search-wrapper-premium {
          flex: 1;
          position: relative;
        }
        .search-icon-premium {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }
        .search-wrapper-premium input {
          width: 100%;
          height: 48px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 0 16px 0 48px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
        }
        .search-wrapper-premium input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .filters-premium {
          display: flex;
          gap: 12px;
        }
        .filters-premium select {
          height: 48px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          outline: none;
        }

        .table-container-premium {
          overflow-x: auto;
        }
        .table-premium {
          width: 100%;
          border-collapse: collapse;
        }
        .table-premium th {
          background: #fff;
          padding: 16px 32px;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-bottom: 1px solid #f1f5f9;
        }
        .table-premium td {
          padding: 16px 32px;
          border-bottom: 1px solid #f8fafc;
          vertical-align: middle;
        }
        .table-premium tr:hover td {
          background: #fcfdfe;
        }

        .row-number {
          font-size: 12px;
          font-weight: 800;
          color: #cbd5e1;
        }
        .kk-number-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          color: #1e40af;
          background: #eff6ff;
          padding: 4px 10px;
          border-radius: 8px;
          display: inline-block;
        }
        .cell-main-text {
          font-size: 14px;
          font-weight: 800;
          color: #334155;
        }
        .cell-sub-text {
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .member-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #059669;
          background: #ecfdf5;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .rt-rw-badge {
          font-size: 12px;
          font-weight: 800;
          color: #6366f1;
        }
        .status-badge-premium {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 8px;
        }
        .status-badge-premium.active { background: #dcfce7; color: #15803d; }
        .status-badge-premium.inactive { background: #f1f5f9; color: #64748b; }

        .btn-add-premium {
          background: #1e3a8a;
          color: #fff;
          border: none;
          padding: 12px 20px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.2);
        }
        .btn-add-premium:hover { background: #1e40af; transform: translateY(-2px); }

        .action-buttons-premium {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .action-btn-p {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
        }
        .action-btn-p.secondary { color: #64748b; }
        .action-btn-p.primary { color: #3b82f6; }
        .action-btn-p.danger { color: #ef4444; }
        .action-btn-p:hover { background: #f8fafc; transform: scale(1.1); }
        .pagination-premium {
          padding: 20px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #f1f5f9;
          background: #fff;
        }
        
        .hide-on-desktop { display: none; }
        .hide-on-mobile { display: table; }

        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
          .hide-on-desktop { display: block !important; }
          
          .stats-grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .stat-card-premium {
            padding: 16px;
            border-radius: 20px;
          }
          .stat-icon-wrapper {
            width: 42px;
            height: 42px;
            border-radius: 12px;
          }
          .stat-icon-wrapper svg { width: 18px; height: 18px; }
          .stat-value-premium { font-size: 20px; }
          .stat-label-premium { font-size: 11px; }

          .chart-row-premium {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .card-header-premium {
            padding: 20px;
          }
          .toolbar-premium {
            padding: 16px;
            flex-direction: column;
          }
          .filters-premium {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .filters-premium select { width: 100%; }
          .pagination-premium {
            flex-direction: column;
            gap: 16px;
            padding: 20px;
            text-align: center;
          }

          /* Mobile Cards Styles */
          .mobile-family-cards {
            padding: 12px;
            background: #f8fafc;
          }
          .mobile-kk-card {
            background: #fff;
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #f1f5f9;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          .m-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          .m-kk-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 800;
            color: #3b82f6;
            background: #eff6ff;
            padding: 4px 10px;
            border-radius: 8px;
          }
          .status-dot { width: 8px; height: 8px; border-radius: 50%; }
          .status-dot.active { background: #10b981; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
          .status-dot.inactive { background: #94a3b8; }
          
          .m-kepala { font-size: 16px; font-weight: 800; color: #1e293b; margin-bottom: 4px; }
          .m-meta { display: flex; gap: 8px; font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 8px; }
          .m-address { font-size: 12px; color: #94a3b8; line-height: 1.4; }
          
          .m-card-footer {
            display: flex;
            gap: 8px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #f8fafc;
          }
          .m-action {
            flex: 1;
            height: 36px;
            border-radius: 10px;
            border: 1px solid #f1f5f9;
            background: #fff;
            font-size: 11px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .m-action.edit { color: #3b82f6; }
          .m-action.delete { color: #ef4444; width: 36px; flex: none; }
        }
        
        .hide-on-desktop { display: none; }
        @media (min-width: 769px) {
          .hide-on-mobile { display: table; }
        }

        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
        }
        .pagination-info-premium {
          font-size: 13px;
          color: #64748b;
        }
        .pagination-info-premium b { color: #1e293b; }
        .pagination-controls-premium {
          display: flex;
          gap: 6px;
        }
        .p-control-btn, .p-number-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          transition: all 0.2s;
        }
        .p-number-btn.active {
          background: #1e3a8a;
          border-color: #1e3a8a;
          color: #fff;
        }
        .p-control-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .p-control-btn:not(:disabled):hover, .p-number-btn:not(.active):hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
