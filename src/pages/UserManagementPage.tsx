import React, { useEffect, useState } from 'react';
import { 
  Users, UserPlus, Shield, 
  Trash2, Edit3, Search, 
  CheckCircle, XCircle, MoreVertical,
  Filter, AlertTriangle, MapPin, Key
} from 'lucide-react';
import { User, AdminRole } from '../types';
import { subscribeToUsers, updateAdminRole, updateUserStatus, deleteUser } from '../services/userService';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, orderBy, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function UserManagementPage() {
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmAdd, setShowConfirmAdd] = useState(false);
  const [showSuccessAdd, setShowSuccessAdd] = useState(false);
  const [showSuccessEdit, setShowSuccessEdit] = useState(false);
  
  // For new admin creation
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    adminRole: 'rt' as AdminRole,
    rt_id: '001',
    rw_id: '011',
    phoneNumber: ''
  });

  // For admin editing
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: '',
    password: '',
    adminRole: 'rt' as AdminRole,
    rt_id: '001',
    rw_id: '011',
    phoneNumber: ''
  });

  useEffect(() => {
    // Only subscribe to users with accountType === 'admin'
    const q = query(collection(db, 'users'), where('accountType', '==', 'admin'));
    const unsub = onSnapshot(q, (snap) => {
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredAdmins = admins.filter(u => {
    const nameMatch = (u.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const usernameMatch = (u.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSearch = nameMatch || usernameMatch || emailMatch;
    const matchesRole = filterRole === 'all' || u.adminRole === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleRoleUpdate = async (userId: string, newRole: AdminRole) => {
    try {
      await updateAdminRole(userId, newRole);
      alert('Role admin berhasil diperbarui.');
    } catch (error) {
      alert('Gagal memperbarui role.');
    }
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      return alert('Mohon lengkapi semua field.');
    }
    setShowConfirmAdd(true);
  };

  const confirmAndCreateAdmin = async () => {
    try {
      const adminId = `admin_${Date.now()}`;
      await setDoc(doc(db, 'users', adminId), {
        ...formData,
        name: formData.username, // Gunakan username sebagai nama
        accountType: 'admin',
        accountStatus: 'active',
        createdAt: serverTimestamp()
      });
      setShowConfirmAdd(false);
      setShowAddModal(false);
      setShowSuccessAdd(true);
    } catch (err) {
      alert('Gagal membuat akun admin.');
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessAdd(false);
    setFormData({ username: '', password: '', adminRole: 'rt', rt_id: '001', rw_id: '011', phoneNumber: '' });
  };

  const handleOpenEditModal = (admin: User) => {
    setEditAdmin(admin);
    setEditFormData({
      username: admin.username || admin.name || '',
      password: '', // Kosongkan agar opsional diisi hanya saat ganti password
      adminRole: admin.adminRole || 'rt',
      rt_id: admin.rt_id || '001',
      rw_id: admin.rw_id || '011',
      phoneNumber: (admin as any).phoneNumber || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdmin) return;
    try {
      const updateData: any = {
        username: editFormData.username,
        name: editFormData.username,
        adminRole: editFormData.adminRole,
        rt_id: editFormData.rt_id,
        rw_id: editFormData.rw_id,
        phoneNumber: editFormData.phoneNumber,
        updatedAt: serverTimestamp()
      };
      
      // Hanya update password jika diisi
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }
      
      await setDoc(doc(db, 'users', editAdmin.id), updateData, { merge: true });
      setShowEditModal(false);
      setShowSuccessEdit(true);
    } catch (err) {
      alert('Gagal memperbarui akun admin.');
    }
  };

  const handleCloseSuccessEdit = () => {
    setShowSuccessEdit(false);
    setEditAdmin(null);
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Hapus akun admin ini secara permanen?')) {
      try {
        await deleteUser(userId);
        alert('Admin berhasil dihapus.');
      } catch (error: any) {
        alert('Gagal menghapus admin.');
      }
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Approved' ? 'Rejected' : 'Approved';
    await updateUserStatus(userId, newStatus);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Manajemen Admin</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Kelola akun administrator sistem dan hak akses wilayah</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} /> Tambah Admin
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="input-with-icon" style={{ flex: 1, minWidth: 250 }}>
          <Search size={18} className="input-icon" />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Cari nama atau username admin..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={18} className="text-gray" />
          <select 
            className="form-input" 
            style={{ width: 160 }}
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
          >
            <option value="all">Semua Role</option>
            <option value="developer">Developer</option>
            <option value="rw">RW Admin</option>
            <option value="rt">RT Admin</option>
          </select>
        </div>
      </div>

      {/* Grid Card Layout for Responsive & Premium Look */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', color: 'var(--gray-400)' }}>
          Memuat data administrator...
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
          <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>Tidak Ada Admin Ditemukan</h3>
          <p style={{ fontSize: 13, marginTop: 4 }}>Coba ubah kata kunci pencarian atau filter role Anda.</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '20px', 
          marginTop: '8px',
          marginBottom: '32px'
        }}>
          {filteredAdmins.map((admin) => {
            const roleColor = admin.adminRole === 'developer' 
              ? { bg: 'var(--purple-50)', text: 'var(--purple-600)', border: 'rgba(139, 92, 246, 0.15)' } 
              : admin.adminRole === 'rw' 
              ? { bg: 'var(--blue-50)', text: 'var(--blue-600)', border: 'rgba(59, 130, 246, 0.15)' } 
              : { bg: 'var(--green-50)', text: 'var(--green-600)', border: 'rgba(16, 185, 129, 0.15)' };

            const isSuspended = admin.status === 'Rejected';

            return (
              <div 
                key={admin.id} 
                className="glass-card" 
                style={{ 
                  padding: '24px', 
                  borderRadius: '24px', 
                  border: isSuspended ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(241, 245, 249, 0.9)',
                  background: isSuspended ? 'rgba(254, 242, 242, 0.4)' : '#ffffff',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  minHeight: '220px'
                }}
              >
                {/* Header: Role & Status badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span className="badge" style={{ 
                    background: roleColor.bg,
                    color: roleColor.text,
                    border: `1px solid ${roleColor.border}`,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    padding: '4px 10px',
                    borderRadius: '10px'
                  }}>
                    {admin.adminRole === 'developer' ? '👨‍💻 Developer' : admin.adminRole === 'rw' ? '👑 RW Admin' : `🛡 RT ${admin.rt_id}`}
                  </span>
                  
                  <div 
                    onClick={() => handleStatusToggle(admin.id, admin.status || 'Approved')} 
                    style={{ cursor: 'pointer' }}
                    title="Klik untuk mengubah status admin"
                  >
                    {isSuspended ? (
                      <span className="badge" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '10px' }}>Suspended</span>
                    ) : (
                      <span className="badge" style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '10px' }}>Active</span>
                    )}
                  </div>
                </div>

                {/* Profile Area */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '16px', 
                    background: isSuspended ? '#fee2e2' : 'var(--blue-50)', 
                    color: isSuspended ? '#ef4444' : 'var(--blue-600)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Shield size={22} />
                  </div>
                  <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--gray-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {admin.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--gray-400)', fontWeight: 500 }}>
                      @{admin.username}
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--gray-600)', fontWeight: 600 }}>
                    <MapPin size={15} style={{ color: 'var(--gray-400)' }} />
                    <span>Tugas: {admin.adminRole === 'rw' ? 'Seluruh RW 011' : admin.adminRole === 'developer' ? 'Sistem Global' : `RT ${admin.rt_id}`}</span>
                  </div>

                  {(admin as any).phoneNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#10b981', fontWeight: 700 }}>
                      <span style={{ fontSize: '14px' }}>🟢</span>
                      <span>+{(admin as any).phoneNumber.startsWith('62') ? (admin as any).phoneNumber : (admin as any).phoneNumber.replace(/^0/, '62')}</span>
                    </div>
                  )}
                </div>

                {/* Footer Action Area */}
                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    title="Edit Admin"
                    onClick={() => handleOpenEditModal(admin)}
                    style={{ 
                      borderRadius: '12px', 
                      height: '36px', 
                      padding: '0 12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => handleDelete(admin.id)}
                    style={{ 
                      borderRadius: '12px', 
                      height: '36px', 
                      padding: '0 12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--red-500)',
                      border: '1px solid rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    <Trash2 size={13} /> Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title">Buat Akun Admin Baru</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label>Username</label>
                    <input type="text" className="form-input" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input type="password" className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Nomor WhatsApp (Aktif)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: 08123456789 atau 628123456789" 
                      value={formData.phoneNumber} 
                      onChange={e => setFormData({...formData, phoneNumber: e.target.value.replace(/\D/g, '')})} 
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>Level Role</label>
                      <select className="form-input" value={formData.adminRole} onChange={e => setFormData({...formData, adminRole: e.target.value as AdminRole})}>
                        <option value="rt">RT Admin</option>
                        <option value="rw">RW Admin</option>
                        <option value="developer">Developer</option>
                      </select>
                    </div>
                    {formData.adminRole === 'rt' && (
                      <div className="form-group">
                        <label>Tugas RT</label>
                        <select className="form-input" value={formData.rt_id} onChange={e => setFormData({...formData, rt_id: e.target.value})}>
                          <option value="001">RT 001</option>
                          <option value="002">RT 002</option>
                          <option value="003">RT 003</option>
                          <option value="004">RT 004</option>
                          <option value="005">RT 005</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Akun Admin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editAdmin && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Akun Admin</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateAdminSubmit}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label>Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editFormData.username} 
                      onChange={e => setEditFormData({...editFormData, username: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Password Baru (Kosongkan jika tidak diubah)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="Ubah jika ingin ganti password"
                      value={editFormData.password} 
                      onChange={e => setEditFormData({...editFormData, password: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Nomor WhatsApp (Aktif)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: 08123456789 atau 628123456789" 
                      value={editFormData.phoneNumber} 
                      onChange={e => setEditFormData({...editFormData, phoneNumber: e.target.value.replace(/\D/g, '')})} 
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>Level Role</label>
                      <select 
                        className="form-input" 
                        value={editFormData.adminRole} 
                        onChange={e => setEditFormData({...editFormData, adminRole: e.target.value as AdminRole})}
                      >
                        <option value="rt">RT Admin</option>
                        <option value="rw">RW Admin</option>
                        <option value="developer">Developer</option>
                      </select>
                    </div>
                    {editFormData.adminRole === 'rt' && (
                      <div className="form-group">
                        <label>Tugas RT</label>
                        <select 
                          className="form-input" 
                          value={editFormData.rt_id} 
                          onChange={e => setEditFormData({...editFormData, rt_id: e.target.value})}
                        >
                          <option value="001">RT 001</option>
                          <option value="002">RT 002</option>
                          <option value="003">RT 003</option>
                          <option value="004">RT 004</option>
                          <option value="005">RT 005</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmAdd && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '32px 24px' }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                background: 'var(--blue-50)', 
                color: 'var(--blue-600)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px' 
              }}>
                <UserPlus size={30} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>
                Konfirmasi Pembuatan Akun
              </h3>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 24 }}>
                Apakah Anda yakin ingin membuat akun admin baru dengan username <strong>@{formData.username}</strong> dan peran sebagai <strong>{formData.adminRole.toUpperCase()}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowConfirmAdd(false)}
                >
                  Batal
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1 }} 
                  onClick={confirmAndCreateAdmin}
                >
                  Ya, Buat Akun
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessAdd && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '32px 24px' }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                background: 'var(--green-100)', 
                color: 'var(--green-600)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px' 
              }}>
                <CheckCircle size={30} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>
                Akun Berhasil Dibuat!
              </h3>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 24 }}>
                Akun administrator baru dengan username <strong>@{formData.username}</strong> dan peran sebagai <strong>{formData.adminRole.toUpperCase()}</strong> telah sukses ditambahkan ke sistem.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }} 
                onClick={handleCloseSuccess}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessEdit && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '32px 24px' }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                background: 'var(--green-100)', 
                color: 'var(--green-600)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px' 
              }}>
                <CheckCircle size={30} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>
                Perubahan Disimpan!
              </h3>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 24 }}>
                Perubahan data akun administrator <strong>@{editFormData.username}</strong> telah sukses diperbarui dan berhasil disimpan ke database.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }} 
                onClick={handleCloseSuccessEdit}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
