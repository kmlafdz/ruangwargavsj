import React, { useEffect, useState } from 'react';
import { 
  Users, UserPlus, Shield, 
  Trash2, Edit3, Search, 
  CheckCircle, XCircle, MoreVertical,
  Filter, AlertTriangle
} from 'lucide-react';
import { User, UserRole } from '../types';
import { subscribeToUsers, updateUserRole, updateUserStatus, deleteUser, createUserFromResident } from '../services/userService';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [residents, setResidents] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [selectedRole, setSelectedRole] = useState('warga');

  useEffect(() => {
    // Fetch residents for the "Add User" dropdown
    const q = query(collection(db, 'residents'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort alphabetically by name/fullName
      data.sort((a: any, b: any) => {
        const nameA = (a.fullName || a.namaLengkap || a.nama || '').toLowerCase();
        const nameB = (b.fullName || b.namaLengkap || b.nama || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setResidents(data);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const rtRoles = ['KETUA RT 01', 'KETUA RT 02', 'KETUA RT 03', 'KETUA RT 04', 'KETUA RT 05', 'KETUA RW'];

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Check if newRole is an RT/RW Chairman role and if it's already taken
    if (rtRoles.includes(newRole)) {
      const isTaken = users.some(u => u.role === newRole && u.id !== userId);
      if (isTaken) {
        alert(`Gagal: Role ${newRole} sudah digunakan oleh user lain. Satu wilayah hanya boleh memiliki satu pemimpin.`);
        return;
      }
    }

    if (confirm(`Ubah role user ini menjadi ${newRole}?`)) {
      try {
        await updateUserRole(userId, newRole);
        alert('Role berhasil diperbarui.');
      } catch (error) {
        alert('Gagal memperbarui role.');
      }
    }
  };

  const handleAddUser = async () => {
    if (!selectedResidentId) return alert('Pilih warga terlebih dahulu.');
    
    const resident = residents.find(r => r.id === selectedResidentId);
    if (!resident) return;

    // Validation for RT roles
    if (rtRoles.includes(selectedRole)) {
      const isTaken = users.some(u => u.role === selectedRole);
      if (isTaken) {
        alert(`Gagal: Role ${selectedRole} sudah digunakan oleh user lain.`);
        return;
      }
    }

    try {
      await createUserFromResident(resident, selectedRole);
      alert('User berhasil ditambahkan. Username default adalah NIK warga.');
      setShowAddModal(false);
      setSelectedResidentId('');
    } catch (error) {
      alert('Gagal menambahkan user.');
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Approved' ? 'Rejected' : 'Approved';
    await updateUserStatus(userId, newStatus);
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Hapus akun user ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) {
      try {
        await deleteUser(userId);
        alert('User dan data terkait berhasil dihapus.');
      } catch (error: any) {
        console.error(error);
        alert('Gagal menghapus user: ' + error.message);
      }
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Manajemen User</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Kelola hak akses dan peran akun pengurus serta warga</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} /> Tambah User
        </button>
      </div>

      {/* Filters & Search */}
      <div className="card" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="input-with-icon" style={{ flex: 1, minWidth: 250 }}>
          <Search size={18} className="input-icon" />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Cari nama, username, atau email..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={18} className="text-gray" />
          <select 
            className="form-input" 
            style={{ width: 150 }}
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
          >
            <option value="all">Semua Role</option>
            <option value="KETUA RW">Ketua RW</option>
            <option value="warga">Warga</option>
            <option value="developer">Developer</option>
            <option disabled>──────────</option>
            <option value="KETUA RT 01">Ketua RT 01</option>
            <option value="KETUA RT 02">Ketua RT 02</option>
            <option value="KETUA RT 03">Ketua RT 03</option>
            <option value="KETUA RT 04">Ketua RT 04</option>
            <option value="KETUA RT 05">Ketua RT 05</option>
          </select>
        </div>
      </div>

      {/* Users Table / Cards */}
      <div className="hide-mobile">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User / Account</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>ID Akun</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>Memuat data user...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>Tidak ada user yang ditemukan.</td></tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-100)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{user.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>@{user.username || user.email?.split('@')[0]}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select 
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gray-200)', fontSize: 12 }}
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="warga">Warga</option>
                          <option value="KETUA RW">Ketua RW</option>
                          <option value="developer">Developer</option>
                          <option disabled>──────────</option>
                          <option value="KETUA RT 01">Ketua RT 01</option>
                          <option value="KETUA RT 02">Ketua RT 02</option>
                          <option value="KETUA RT 03">Ketua RT 03</option>
                          <option value="KETUA RT 04">Ketua RT 04</option>
                          <option value="KETUA RT 05">Ketua RT 05</option>
                        </select>
                      </td>
                      <td>
                        <div 
                          onClick={() => handleStatusToggle(user.id, user.status || 'Approved')}
                          style={{ cursor: 'pointer' }}
                        >
                          {user.status === 'Rejected' ? (
                            <span className="badge" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>Suspended</span>
                          ) : (
                            <span className="badge" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>Active</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray-400)', fontFamily: 'monospace' }}>
                        {user.id.slice(0, 8)}...
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: 6 }} title="Edit User">
                            <Edit3 size={14} />
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: 6, color: 'var(--red-500)' }} 
                            title="Hapus User"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="show-mobile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
             <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Memuat data user...</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Tidak ada user yang ditemukan.</div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>@{user.username}</div>
                    </div>
                  </div>
                  <div className="badge" style={{ background: user.status === 'Rejected' ? 'var(--red-100)' : 'var(--green-100)', color: user.status === 'Rejected' ? 'var(--red-600)' : 'var(--green-600)' }}>
                    {user.status === 'Rejected' ? 'Suspended' : 'Active'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 11 }}>Ubah Role</label>
                    <select 
                      className="form-input"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      <option value="warga">Warga</option>
                      <option value="KETUA RW">Ketua RW</option>
                      <option value="developer">Developer</option>
                      <option disabled>──────────</option>
                      <option value="KETUA RT 01">Ketua RT 01</option>
                      <option value="KETUA RT 02">Ketua RT 02</option>
                      <option value="KETUA RT 03">Ketua RT 03</option>
                      <option value="KETUA RT 04">Ketua RT 04</option>
                      <option value="KETUA RT 05">Ketua RT 05</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleStatusToggle(user.id, user.status || 'Approved')}>
                      {user.status === 'Rejected' ? 'Aktifkan Akun' : 'Suspend Akun'}
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(user.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Safety Alert */}
      <div style={{ marginTop: 24, padding: 16, background: 'var(--blue-50)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--blue-800)' }}>
        <Shield size={24} />
        <div style={{ fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>Keamanan Sistem</div>
          <div style={{ opacity: 0.8 }}>Hanya role <strong>Admin</strong> dan <strong>Developer</strong> yang dapat mengakses halaman manajemen user ini.</div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal modal-mobile-fix" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Tambah User dari Data Warga</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="form-group">
                  <label>Pilih Warga</label>
                  <select 
                    className="form-input" 
                    value={selectedResidentId}
                    onChange={e => setSelectedResidentId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Warga dari Database --</option>
                    {residents.length === 0 ? (
                      <option disabled>Tidak ada data warga ditemukan</option>
                    ) : (
                      residents.map(res => (
                        <option key={res.id} value={res.id}>
                          {(res.fullName || res.namaLengkap || res.nama || 'Tanpa Nama')} - RT {res.rt || '-'} ({res.nik})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>Pilih Role</label>
                  <select 
                    className="form-input" 
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                  >
                    <option value="warga">Warga</option>
                    <option value="KETUA RW">Ketua RW</option>
                    <option value="developer">Developer</option>
                    <option disabled>──────────</option>
                    <option value="KETUA RT 01">Ketua RT 01</option>
                    <option value="KETUA RT 02">Ketua RT 02</option>
                    <option value="KETUA RT 03">Ketua RT 03</option>
                    <option value="KETUA RT 04">Ketua RT 04</option>
                    <option value="KETUA RT 05">Ketua RT 05</option>
                  </select>
                </div>

                <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                  <strong>Catatan:</strong> Username default adalah <strong>NIK</strong>, dan password sementara adalah <strong>Tanggal Lahir (YYYY-MM-DD)</strong>.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddUser}>Simpan User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
