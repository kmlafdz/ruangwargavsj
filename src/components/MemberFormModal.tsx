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
  tempatLahir: '', agama: 'ISLAM',
  noTelepon: '', hubungan: 'Anak', statusPerkawinan: 'Belum Kawin',
  pekerjaan: 'Belum/Tidak Bekerja', blok: 'A', nomorRumah: '', rt: '01', rw: '051'
};

export default function MemberFormModal({ member, existingMembers, onSave, onClose }: MemberFormModalProps) {
  const isEdit = !!member?.id;
  const [form, setForm] = useState<any>(() => {
    if (!member) return EMPTY_FORM;
    // Normalize data from different possible sources (Firestore/API)
    return {
      ...EMPTY_FORM,
      ...member,
      namaLengkap: member.namaLengkap || (member as any).nama || (member as any).fullName || '',
      noTelepon: member.noTelepon || (member as any).nomorHP || ''
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, val: string) => {
    setForm((f: any) => ({ ...f, [field]: val }));
    setErrors((e: any) => ({ ...e, [field]: '' }));
    if (field === 'hubungan') setErrors((e: any) => ({ ...e, hubungan: '' }));
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
    if (!form.blok || !form.blok.trim()) e.blok = 'Blok wajib diisi';
    if (!form.nomorRumah || !form.nomorRumah.trim()) e.nomorRumah = 'Nomor rumah wajib diisi';

    // Only one KK head
    if (form.hubungan === 'Kepala Keluarga') {
      const existing = existingMembers.find(
        m => (m.hubungan || m.statusKeluarga) === 'Kepala Keluarga' && m.id !== member?.id
      );
      if (existing) e.hubungan = `Kepala Keluarga sudah ada (${(existing as any).nama || existing.namaLengkap})`;
    }
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    
    const fullAddress = `Blok ${form.blok} No. ${form.nomorRumah}, RT ${form.rt}/RW ${form.rw}`;
    
    onSave({ 
      ...form, 
      alamat: fullAddress,
      id: form.id || `nik-${Date.now()}` 
    });
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
          {errors.hubungan && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
              <AlertCircle size={16} /> {errors.hubungan}
            </div>
          )}
          <div className="form-grid">
            <Field name="nik" label="NIK" required>
              <input 
                className={`form-input${errors.nik ? ' error' : ''}`} 
                value={form.nik}
                onChange={e => !isEdit && set('nik', e.target.value)} 
                placeholder="16 digit NIK" 
                maxLength={16} 
                readOnly={isEdit}
                style={isEdit ? { background: '#f1f5f9', cursor: 'not-allowed' } : {}}
              />
            </Field>
            <Field name="namaLengkap" label="Nama Lengkap" required>
              <input 
                className={`form-input${errors.namaLengkap ? ' error' : ''}`} 
                value={form.namaLengkap}
                onChange={e => !isEdit && set('namaLengkap', e.target.value)} 
                placeholder="Nama sesuai KTP"
                readOnly={isEdit}
                style={isEdit ? { background: '#f1f5f9', cursor: 'not-allowed' } : {}}
              />
            </Field>
            <Field name="jenisKelamin" label="Jenis Kelamin" required>
              <select className="form-input" value={form.jenisKelamin} onChange={e => set('jenisKelamin', e.target.value)}>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </Field>
            <Field name="tanggalLahir" label="Tanggal Lahir (DD/MM/YYYY)" required>
              <input 
                type="text" 
                className={`form-input${errors.tanggalLahir ? ' error' : ''}`}
                value={form.tanggalLahir} 
                placeholder="Contoh: 31/12/1990"
                onChange={e => {
                  let val = e.target.value.replace(/[^0-9/]/g, '');
                  if (val.length === 2 && !val.includes('/')) val += '/';
                  if (val.length === 5 && val.split('/').length === 2) val += '/';
                  if (val.length > 10) val = val.slice(0, 10);
                  set('tanggalLahir', val);
                }}
              />
            </Field>
            <Field name="hubungan" label="Status dalam Keluarga" required>
              <select className="form-input" value={form.hubungan} onChange={e => set('hubungan', e.target.value)}>
                {STATUS_KELUARGA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field name="tempatLahir" label="Tempat Lahir">
              <input 
                className="form-input" 
                value={form.tempatLahir}
                onChange={e => set('tempatLahir', e.target.value.toUpperCase())} 
                placeholder="Contoh: JAKARTA"
              />
            </Field>
            <Field name="agama" label="Agama">
              <select className="form-input" value={form.agama} onChange={e => set('agama', e.target.value)}>
                {['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDHA', 'KONGHUCU'].map(a => <option key={a} value={a}>{a}</option>)}
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
            <Field name="blok" label="Blok" required>
              <select className="form-input" value={form.blok} onChange={e => set('blok', e.target.value)}>
                {"ABCDEFGHIJKLMNOPQRST".split("").map(b => <option key={b} value={b}>Blok {b}</option>)}
              </select>
            </Field>
            <Field name="nomorRumah" label="Nomor Rumah" required>
              <select className="form-input" value={form.nomorRumah} onChange={e => set('nomorRumah', e.target.value)}>
                <option value="">Pilih No...</option>
                {Array.from({length: 100}, (_, i) => i + 1).map(n => <option key={n} value={n.toString()}>{n}</option>)}
              </select>
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
