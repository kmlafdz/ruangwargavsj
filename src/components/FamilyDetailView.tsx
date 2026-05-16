import React from 'react';
import { UserCircle, Edit2, Trash2, Phone, Briefcase } from 'lucide-react';
import { Family, FamilyMember } from '../types';

interface FamilyDetailViewProps {
  family: Family;
  members: FamilyMember[];
  onBack: () => void;
  onAddMember: () => void;
  onEditMember: (member: FamilyMember) => void;
  onDeleteMember: (member: FamilyMember) => void;
}

const ROLE_CLASS: Record<string, string> = {
  'Kepala Keluarga': 'role-kk',
  'Suami': 'role-spouse',
  'Istri': 'role-spouse',
  'Anak': 'role-child',
  'Orang Tua': 'role-parent',
};

const getRoleClass = (r: string) => ROLE_CLASS[r] || 'role-other';

const getInitials = (name: string) => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const calcAge = (dob: string) => {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' th';
};

const HIERARCHY_ORDER = [
  'Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Cucu', 'Menantu', 'Orang Tua', 'Saudara', 'Lainnya'
];

export default function FamilyDetailView({ family, members, onBack, onAddMember, onEditMember, onDeleteMember }: FamilyDetailViewProps) {
  const grouped = HIERARCHY_ORDER.reduce((acc: Record<string, FamilyMember[]>, role) => {
    const found = members.filter(m => (m.hubungan || m.statusKeluarga) === role);
    if (found.length) acc[role] = found;
    return acc;
  }, {});


  return (
    <div>
      {/* Back + KK Info */}
      <div className="family-detail-header">
        <div className="family-kk-badge">
          <div className="kk-label">Nomor Kartu Keluarga</div>
          <div className="kk-number">{family.nomorKK}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 2 }}>Kepala Keluarga</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)' }}>{family.kepalaKeluarga}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            {family.alamat} &nbsp;·&nbsp; RT {family.rt} / RW {family.rw}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${family.status === 'Aktif' ? 'badge-active' : 'badge-inactive'}`}>
            <span className="badge-dot-small" />
            {family.status}
          </span>
          <span className="badge badge-blue">{members.length} Anggota</span>
          <button className="btn btn-primary btn-sm" onClick={onAddMember}>+ Tambah Anggota</button>
        </div>
      </div>

      {/* Hierarchy */}
      {Object.entries(grouped).map(([role, mems]) => (
        <div className="hierarchy-section" key={role}>
          <div className="hierarchy-title">{role}</div>
          <div className="member-cards">
            {mems.map(m => (
              <MemberCard key={m.id} member={m} onEdit={() => onEditMember(m)} onDelete={() => onDeleteMember(m)} />
            ))}
          </div>
        </div>
      ))}

      {members.length === 0 && (
        <div className="empty-state">
          <UserCircle size={48} />
          <p>Belum ada anggota keluarga terdaftar.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAddMember}>Tambah Anggota Pertama</button>
        </div>
      )}
    </div>
  );
}

interface MemberCardProps {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}

function MemberCard({ member, onEdit, onDelete }: MemberCardProps) {
  const isMale = member.jenisKelamin === 'LAKI-LAKI' || member.jenisKelamin === 'Laki-laki';
  return (
    <div className={`member-card ${member.hubungan === 'Kepala Keluarga' ? 'kk-head' : ''}`}>
      <div className={`member-avatar ${isMale ? 'avatar-male' : 'avatar-female'}`}>
        {getInitials(member.fullName || member.namaLengkap || '')}
      </div>
      <div className="member-name">{member.fullName || member.namaLengkap}</div>
      <div className="member-nik">{member.nik}</div>
      <span className={`member-role-badge ${getRoleClass(member.hubungan || 'Anggota')}`}>
        {member.hubungan || 'Anggota'}
      </span>
      <div className="member-meta">
        {isMale ? '♂' : '♀'} {member.jenisKelamin} · {calcAge(member.birthDate || member.tanggalLahir || '')}
      </div>
      {member.pekerjaan && (
        <div className="member-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'center' }}>
          <Briefcase size={11} /> {member.pekerjaan}
        </div>
      )}
      {(member.phone || member.noTelepon) && (
        <div className="member-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'center' }}>
          <Phone size={11} /> {member.phone || member.noTelepon}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center' }}>
        <button className="btn btn-secondary btn-icon btn-sm" onClick={onEdit} title="Edit"><Edit2 size={13} /></button>
        <button className="btn btn-danger btn-icon btn-sm" onClick={onDelete} title="Hapus"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

