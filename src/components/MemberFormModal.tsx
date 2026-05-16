import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { FamilyMember } from '../types';

interface MemberFormModalProps {
  member: FamilyMember | null;
  existingMembers: FamilyMember[];
  kkId: string;
  onSave: (data: any) => void;
  onClose: () => void;
}

const STATUS_KELUARGA = [
  'Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Orang Tua', 'Menantu', 'Cucu', 'Saudara', 'Lainnya'
];
const STATUS_PERKAWINAN = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];
const PEKERJAAN_LIST = [
  'Belum/Tidak Bekerja', 'Pelajar', 'Mahasiswa', 'Pegawai Negeri Sipil', 'TNI/Polri',
  'Pegawai Swasta', 'Wiraswasta', 'Pedagang', 'Petani', 'Nelayan', 'Buruh', 'Guru',
  'Dokter', 'Perawat', 'Ibu Rumah Tangga', 'Pensiunan', 'Lainnya'
];

const EMPTY_FORM = {
  nik: '', namaLengkap: '', jenisKelamin: 'Laki-laki', tanggalLahir: '',
  noTelepon: '', statusKeluarga: 'Anak', statusPerkawinan: 'Belum Kawin',
  pekerjaan: 'Belum/Tidak Bekerja', alamat: ''
};

export default function MemberFormModal({ member, existingMembers, onSave, onClose }: MemberFormModalProps) {
  const isEdit = !!member?.id;
  const [form, setForm] = useState<any>(member || EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, val: string) => {
    setForm((f: any) => ({ ...f, [field]: val }));
    setErrors((e: any) => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nik.trim()) e.nik = 'NIK wajib diisi';
    else if (!/^\d{16}$/.test(form.nik)) e.nik = 'NIK harus 16 digit angka';
    else {
      const dup = existingMembers.find(m => m.nik === form.nik && m.id !== form.id);
      if (dup) e.nik = 'NIK sudah terdaftar';
    }
    if (!form.namaLengkap.trim()) e.namaLengkap = 'Nama lengkap wajib diisi';
    if (!form.tanggalLahir) e.tanggalLahir = 'Tanggal lahir wajib diisi';
    if (!form.alamat.trim()) e.alamat = 'Alamat wajib diisi';

    // Only one KK head
    if (form.statusKeluarga === 'Kepala Keluarga') {
      const existing = existingMembers.find(
        m => m.statusKeluarga === 'Kepala Keluarga' && m.id !== form.id
      );
      if (existing) e.statusKeluarga = `Kepala Keluarga sudah ada (${existing.namaLengkap})`;
    }
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, id: form.id || `nik-${Date.now()}` });
  };

  const Field = ({ name, label, required, children }: { name: string; label: string; required?: boolean; children: React.ReactNode }) => (
    <div className={`form-group${name === 'alamat' ? ' full' : ''}`}>
      <label>{label}{required && <span className="required">*</span>}</label>
      {children}
      {errors[name] && <span className="error-msg"><AlertCircle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{errors[name]}</span>}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit Anggota Keluarga' : 'Tambah Anggota Keluarga'}</span>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {errors.statusKeluarga && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} /> {errors.statusKeluarga}
            </div>
          )}
          <div className="form-grid">
            <Field name="nik" label="NIK" required>
              <input 
                className={`form-input${errors.nik ? ' error' : ''}`} 
                value={form.nik}
                onChange={e => set('nik', e.target.value)} 
                placeholder="16 digit NIK" 
                maxLength={16} 
              />
            </Field>
            <Field name="namaLengkap" label="Nama Lengkap" required>
              <input 
                className={`form-input${errors.namaLengkap ? ' error' : ''}`} 
                value={form.namaLengkap}
                onChange={e => set('namaLengkap', e.target.value)} 
                placeholder="Nama sesuai KTP"
              />
            </Field>
            <Field name="jenisKelamin" label="Jenis Kelamin" required>
              <select className="form-input" value={form.jenisKelamin} onChange={e => set('jenisKelamin', e.target.value)}>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </Field>
            <Field name="tanggalLahir" label="Tanggal Lahir" required>
              <input 
                type="date" 
                className={`form-input${errors.tanggalLahir ? ' error' : ''}`}
                value={form.tanggalLahir} 
                onChange={e => set('tanggalLahir', e.target.value)} 
              />
            </Field>
            <Field name="statusKeluarga" label="Status dalam Keluarga" required>
              <select className="form-input" value={form.statusKeluarga} onChange={e => set('statusKeluarga', e.target.value)}>
                {STATUS_KELUARGA.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field name="statusPerkawinan" label="Status Perkawinan" required>
              <select className="form-input" value={form.statusPerkawinan} onChange={e => set('statusPerkawinan', e.target.value)}>
                {STATUS_PERKAWINAN.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field name="pekerjaan" label="Pekerjaan">
              <select className="form-input" value={form.pekerjaan} onChange={e => set('pekerjaan', e.target.value)}>
                {PEKERJAAN_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field name="noTelepon" label="No. Telepon">
              <input 
                className="form-input" 
                value={form.noTelepon}
                onChange={e => set('noTelepon', e.target.value)} 
                placeholder="08xx-xxxx-xxxx"
              />
            </Field>
            <Field name="alamat" label="Alamat Lengkap" required>
              <textarea 
                className={`form-input${errors.alamat ? ' error' : ''}`} 
                rows={2}
                value={form.alamat} 
                onChange={e => set('alamat', e.target.value)}
                placeholder="Jl. ..., RT/RW, Kelurahan, Kota" 
                style={{ resize: 'vertical' }}
              />
            </Field>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah Anggota'}
          </button>
        </div>
      </div>
    </div>
  );
}
