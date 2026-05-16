import React from 'react';
import { UserCircle, Edit2, Trash2, Phone, Briefcase, ChevronLeft, MapPin, ShieldCheck, User } from 'lucide-react';
import { Family, FamilyMember } from '../types';
import { motion } from 'framer-motion';

interface FamilyDetailViewProps {
  family: Family;
  members: FamilyMember[];
  onBack: () => void;
  onAddMember: () => void;
  onEditMember: (member: FamilyMember) => void;
  onDeleteMember: (member: FamilyMember) => void;
}

const getInitials = (name: string) => name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const calcAge = (dob: string) => {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' th';
};

const HIERARCHY_ORDER = [
  'Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Cucu', 'Menantu', 'Orang Tua', 'Saudara', 'Lainnya'
];

export default function FamilyDetailView({ family, members, onBack, onAddMember, onEditMember, onDeleteMember }: FamilyDetailViewProps) {
  // First, group by standard hierarchy
  const grouped = HIERARCHY_ORDER.reduce((acc: Record<string, FamilyMember[]>, role) => {
    const found = members.filter(m => (m.hubungan || m.statusKeluarga) === role);
    if (found.length) acc[role] = found;
    return acc;
  }, {});

  // Then, find any members NOT in the standard hierarchy to ensure NO ONE is hidden
  const accountedForIds = new Set(Object.values(grouped).flat().map(m => m.id));
  const others = members.filter(m => !accountedForIds.has(m.id));
  
  if (others.length) {
    grouped['Anggota Lain'] = others;
  }

  return (
    <div className="detail-view-container">
      {/* Header Panel */}
      <div className="detail-header-panel">
        <div className="header-top">
          <button className="back-btn-glass" onClick={onBack}>
            <ChevronLeft size={18} /> Kembali ke Daftar
          </button>
          <div className="kk-badge-premium">
            <span className="kk-label">NO. KARTU KELUARGA</span>
            <span className="kk-val">{family.nomorKK}</span>
          </div>
        </div>

        <div className="header-content-main">
          <div className="family-icon-box">
            <UserCircle size={48} color="#fff" />
          </div>
          <div className="family-info-text">
            <h2 className="kepala-keluarga-name">{family.kepalaKeluarga}</h2>
            <div className="location-info">
              <MapPin size={14} /> {family.alamat} &nbsp;·&nbsp; RT {family.rt} / RW {family.rw}
            </div>
          </div>
          <div className="header-stats-badges">
            <div className="stat-badge-glass">
              <ShieldCheck size={14} /> {family.status || 'Aktif'}
            </div>
            <div className="stat-badge-glass">
              <User size={14} /> {members.length} Anggota
            </div>
          </div>
          <button className="btn-add-member-premium" onClick={onAddMember}>
            + Tambah Anggota
          </button>
        </div>
      </div>

      {/* Members Hierarchy */}
      <div className="hierarchy-container-premium">
        {Object.entries(grouped).length > 0 ? (
          Object.entries(grouped).map(([role, mems]) => (
            <div className="role-group-section" key={role}>
              <h3 className="role-group-title">{role}</h3>
              <div className="members-grid-premium">
                {mems.map(m => (
                  <MemberCardPremium 
                    key={m.id} 
                    member={m} 
                    onEdit={() => onEditMember(m)} 
                    onDelete={() => onDeleteMember(m)} 
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-members-state">
            <div className="empty-icon-circle"><User size={40} /></div>
            <h4>Belum ada anggota terdaftar</h4>
            <p>Silakan tambahkan anggota keluarga pertama untuk KK ini.</p>
            <button className="btn-add-member-premium" onClick={onAddMember}>Tambah Anggota Pertama</button>
          </div>
        )}
      </div>

      <style>{`
        .detail-view-container {
          padding: 0;
          background: #fff;
          min-height: 500px;
        }
        .detail-header-panel {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          padding: 32px;
          color: #fff;
          position: relative;
          overflow: hidden;
        }
        .detail-header-panel::after {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 300px; height: 300px;
          background: rgba(255,255,255,0.05);
          border-radius: 50%;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .back-btn-glass {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: all 0.2s;
        }
        .back-btn-glass:hover { background: rgba(255,255,255,0.2); }

        .kk-badge-premium {
          text-align: right;
        }
        .kk-label {
          display: block;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          opacity: 0.7;
        }
        .kk-val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .header-content-main {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .family-icon-box {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.15);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .family-info-text {
          flex: 1;
        }
        .kepala-keluarga-name {
          font-size: 28px;
          font-weight: 900;
          margin: 0;
          font-style: italic;
        }
        .location-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          opacity: 0.8;
          margin-top: 6px;
        }

        .header-stats-badges {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-badge-glass {
          background: rgba(255,255,255,0.1);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .btn-add-member-premium {
          background: #fff;
          color: #1e3a8a;
          border: none;
          padding: 12px 24px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .btn-add-member-premium:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0,0,0,0.15); }

        .hierarchy-container-premium {
          padding: 40px 32px;
        }
        .role-group-section {
          margin-bottom: 40px;
        }
        .role-group-title {
          font-size: 12px;
          font-weight: 900;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .role-group-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #f1f5f9;
        }

        .members-grid-premium {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .empty-members-state {
          text-align: center;
          padding: 80px 0;
          color: #94a3b8;
        }
        .empty-icon-circle {
          width: 80px;
          height: 80px;
          background: #f8fafc;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }
        .empty-members-state h4 { color: #334155; margin-bottom: 8px; }
        .empty-members-state p { margin-bottom: 24px; font-size: 14px; }

        @media (max-width: 768px) {
          .detail-header-panel { padding: 24px; }
          .header-top { flex-direction: column; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
          .kk-badge-premium { text-align: left; }
          .kk-val { font-size: 16px; }
          
          .header-content-main { flex-direction: column; align-items: flex-start; gap: 20px; }
          .family-icon-box { width: 64px; height: 64px; border-radius: 18px; }
          .family-icon-box svg { width: 32px; height: 32px; }
          .kepala-keluarga-name { font-size: 20px; }
          .location-info { font-size: 12px; }
          
          .header-stats-badges { flex-direction: row; flex-wrap: wrap; }
          .btn-add-member-premium { width: 100%; text-align: center; }
          
          .hierarchy-container-premium { padding: 32px 20px; }
          .members-grid-premium { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function MemberCardPremium({ member, onEdit, onDelete }: { member: FamilyMember; onEdit: () => void; onDelete: () => void }) {
  const isMale = member.jenisKelamin?.toUpperCase() === 'LAKI-LAKI';
  const name = member.fullName || member.namaLengkap || member.nama;
  const nik = member.nik;
  const role = member.hubungan || member.statusKeluarga;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="member-card-premium"
    >
      <div className="card-top">
        <div className={`avatar-premium ${isMale ? 'male' : 'female'}`}>
          {getInitials(name)}
        </div>
        <div className="main-info">
          <div className="name-p">{name}</div>
          <div className="nik-p">{nik}</div>
        </div>
      </div>

      <div className="card-divider" />

      <div className="card-details-grid">
        <div className="detail-item">
          <span className="d-label">USIA</span>
          <span className="d-val">{calcAge(member.birthDate || member.tanggalLahir || '')}</span>
        </div>
        <div className="detail-item">
          <span className="d-label">GENDER</span>
          <span className="d-val">{isMale ? 'Laki-laki' : 'Perempuan'}</span>
        </div>
        <div className="detail-item full">
          <span className="d-label">PEKERJAAN</span>
          <span className="d-val"><Briefcase size={10} /> {member.pekerjaan || 'Tidak bekerja'}</span>
        </div>
        {member.noTelepon && (
          <div className="detail-item full">
            <span className="d-label">KONTAK</span>
            <span className="d-val"><Phone size={10} /> {member.noTelepon}</span>
          </div>
        )}
      </div>

      <div className="card-actions-premium">
        <button className="c-action-btn edit" onClick={onEdit}><Edit2 size={14} /> EDIT</button>
        <button className="c-action-btn delete" onClick={onDelete}><Trash2 size={14} /></button>
      </div>

      <style>{`
        .member-card-premium {
          background: #fff;
          border-radius: 20px;
          padding: 20px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          transition: all 0.3s ease;
        }
        .member-card-premium:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);
          border-color: #e2e8f0;
        }

        .card-top {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }
        .avatar-premium {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 900;
        }
        .male { background: #eff6ff; color: #3b82f6; }
        .female { background: #fdf2f8; color: #ec4899; }

        .name-p { font-size: 15px; font-weight: 800; color: #1e293b; margin-bottom: 2px; }
        .nik-p { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #94a3b8; letter-spacing: 1px; }

        .card-divider { hieght: 1px; background: #f8fafc; margin: 0 -20px 16px; }

        .card-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .detail-item { display: flex; flex-direction: column; }
        .detail-item.full { grid-column: span 2; }
        .d-label { font-size: 9px; font-weight: 900; color: #cbd5e1; letter-spacing: 0.1em; margin-bottom: 4px; }
        .d-val { font-size: 12px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 4px; }

        .card-actions-premium {
          display: flex;
          gap: 8px;
        }
        .c-action-btn {
          flex: 1;
          height: 38px;
          border-radius: 10px;
          border: 1px solid #f1f5f9;
          font-size: 11px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .c-action-btn.edit { background: #f8fafc; color: #3b82f6; }
        .c-action-btn.delete { width: 38px; flex: none; background: #fff; color: #ef4444; }
        .c-action-btn:hover { background: #f1f5f9; }
        .c-action-btn.delete:hover { background: #fef2f2; border-color: #fee2e2; }
      `}</style>
    </motion.div>
  );
}

