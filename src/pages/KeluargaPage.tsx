import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Eye, Edit2, Trash2,
  ChevronLeft, ChevronRight, Users, Home, UserCheck, Activity
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
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
    <div className="stat-card">
      <div className={`stat-icon ${colorClass}`}>{icon}</div>
      <div>
        {loading
          ? <div style={{ height: 28, width: 48, background: 'var(--gray-100)', borderRadius: 6, marginBottom: 6 }} />
          : <div className="stat-value">{value}</div>}
        <div className="stat-label">{label}</div>
        {change && !loading && <div className="stat-change up">↑ {change}</div>}
      </div>
    </div>
  );
}

// ── Detail wrapper ──
function DetailPane({ family, onBack, showToast }: { family: any; onBack: () => void; showToast: any }) {
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

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
          existingMembers={family.members}
          kkId={family?.id || ''}
          onSave={() => { showToast('Fitur simpan dinonaktifkan dalam mode simulasi'); setShowMemberForm(false); }}
          onClose={() => { setShowMemberForm(false); setEditingMember(null); }}
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
  const aktif = families.length;

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
    showToast('Mode Simulasi: Data KK tidak dapat diubah langsung.');
    setShowFamilyForm(false);
  };

  const handleDeleteFamily = async () => {
    showToast('Mode Simulasi: Data KK tidak dapat dihapus langsung.', 'error');
    setConfirmDelete(null);
  };

  const openDetail = (fam: any) => { setSelectedFamily(fam); setView('detail'); };
  const backToList = () => { setSelectedFamily(null); setView('list'); };

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<Home size={22} />} colorClass="blue" value={totalKK} label="Total Kartu Keluarga" loading={loading} />
        <StatCard icon={<Users size={22} />} colorClass="green" value={totalWarga} label="Total Warga" loading={loading} />
        <StatCard icon={<UserCheck size={22} />} colorClass="yellow" value={totalKK} label="Kepala Keluarga" loading={loading} />
        <StatCard icon={<Activity size={22} />} colorClass="indigo" value={aktif} label="KK Aktif" loading={loading} />
      </div>

      <div className="chart-row">
        <div className="card">
          <div className="card-header"><span className="card-title">Warga per RT</span></div>
          <div className="card-body" style={{ padding: '16px 22px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rtCounts} barSize={32}>
                <XAxis dataKey="rt" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="warga" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Distribusi Status KK</span></div>
          <div className="card-body" style={{ padding: '16px 22px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={[{ name: 'Aktif', value: aktif }, { name: 'Tidak Aktif', value: 0 }]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={4}>
                  <Cell fill="#3b82f6" />
                  <Cell fill="#e2e8f0" />
                </Pie>
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        {view === 'list' ? (
          <>
            <div className="card-header">
              <span className="card-title">Daftar Kartu Keluarga</span>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingFamily(null); setShowFamilyForm(true); }}>
                <Plus size={15} /> Tambah KK
              </button>
            </div>

            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15} className="search-icon" />
                <input placeholder="Cari nomor KK, kepala keluarga, alamat…"
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <select className="filter-select" value={filterRT} onChange={e => { setFilterRT(e.target.value); setPage(1); }}>
                <option value="">Semua RT</option>
                {['001', '002', '003', '004', '005'].map(r => <option key={r} value={r}>RT {r}</option>)}
              </select>
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Nomor KK</th><th>Kepala Keluarga</th>
                    <th>Anggota</th><th>Alamat</th><th>RT/RW</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton /> : (
                  <tbody>
                    {paginated.length === 0 && (
                      <tr><td colSpan={8} style={{textAlign:'center', padding:40, color:'var(--gray-400)'}}>Tidak ada data yang ditemukan.</td></tr>
                    )}
                    {paginated.map((fam, idx) => (
                      <tr key={fam.id}>
                        <td style={{ color: 'var(--gray-400)', fontWeight: 600 }}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                        <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--blue-700)', fontSize: 12 }}>{fam.nomorKK}</span></td>
                        <td><div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{fam.kepalaKeluarga}</div></td>
                        <td><span className="badge badge-blue"><Users size={11} /> {fam.jumlahAnggota || 0} orang</span></td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fam.alamat}</td>
                        <td><span style={{ fontWeight: 600 }}>RT {fam.rt} / RW {fam.rw}</span></td>
                        <td><span className="badge badge-active"><span className="badge-dot-small" />{fam.status || 'Aktif'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button className="btn btn-secondary btn-icon btn-sm" title="Detail" onClick={() => openDetail(fam)}><Eye size={13} /></button>
                            <button className="btn btn-secondary btn-icon btn-sm" title="Edit" onClick={() => { setEditingFamily(fam); setShowFamilyForm(true); }}><Edit2 size={13} /></button>
                            <button className="btn btn-danger btn-icon btn-sm" title="Hapus" onClick={() => setConfirmDelete({ item: fam })}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="pagination">
                <span className="pagination-info">
                  Menampilkan {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length} data
                </span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => goToPage(page - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => goToPage(p)}>{p}</button>
                  ))}
                  <button className="page-btn" onClick={() => goToPage(page + 1)} disabled={page === totalPages}><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="card-header">
              <div className="breadcrumb" style={{ margin: 0 }}>
                <span className="link" onClick={backToList}>Daftar KK</span>
                <span className="sep">›</span>
                <span>{selectedFamily?.kepalaKeluarga}</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={backToList}><ChevronLeft size={14} /> Kembali</button>
            </div>
            <div className="card-body">
              <DetailPane family={selectedFamily} onBack={backToList} showToast={showToast} />
            </div>
          </>
        )}
      </div>

      {showFamilyForm && (
        <FamilyFormModal
          family={editingFamily}
          allFamilies={families}
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
    </div>
  );
}
