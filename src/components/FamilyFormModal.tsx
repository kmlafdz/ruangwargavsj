import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Family } from '../types';

interface FamilyFormModalProps {
  family: Family | null;
  allFamilies: Family[];
  familyMembers?: any[];
  onSave: (data: any) => void;
  onClose: () => void;
}

const EMPTY = { nomorKK: '', kepalaKeluarga: '', blok: 'A', nomorRumah: '', rt: '001', rw: '011' };

export default function FamilyFormModal({ family, allFamilies, familyMembers, onSave, onClose }: FamilyFormModalProps) {
  const isEdit = !!family?.id;
  const [form, setForm] = useState<any>(family || EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => { 
    setForm((f: any) => ({ ...f, [k]: v })); 
    setErrors((e: any) => ({ ...e, [k]: '' })); 
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nomorKK.trim()) e.nomorKK = 'Nomor KK wajib diisi';
    else if (!/^\d{16}$/.test(form.nomorKK)) e.nomorKK = 'Nomor KK harus 16 digit';
    else {
      const dup = allFamilies.find(f => f.nomorKK === form.nomorKK && f.id !== form.id);
      if (dup) e.nomorKK = 'Nomor KK sudah terdaftar';
    }
    if (!form.kepalaKeluarga.trim()) e.kepalaKeluarga = 'Nama kepala keluarga wajib diisi';
    if (!form.blok.trim()) e.blok = 'Blok wajib diisi';
    if (!form.nomorRumah.trim()) e.nomorRumah = 'Nomor rumah wajib diisi';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    
    // Construct full address for compatibility
    const fullAddress = `Blok ${form.blok} No. ${form.nomorRumah}, RT ${form.rt}/RW ${form.rw}`;
    
    onSave({ 
      ...form, 
      alamat: fullAddress,
      id: form.id || `kk-${Date.now()}`, 
      jumlahAnggota: form.jumlahAnggota || 0, 
      status: form.status || 'Aktif',
      createdAt: form.createdAt || new Date().toISOString().slice(0, 10) 
    });
  };

  const Field = ({ name, label, req, children }: { name: string; label: string; req?: boolean; children: React.ReactNode }) => (
    <div className={`form-group${name === 'alamat' ? ' full' : ''}`}>
      <label>{label}{req && <span className="required">*</span>}</label>
      {children}
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit Data KK' : 'Tambah Kartu Keluarga'}</span>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <Field name="nomorKK" label="Nomor KK" req>
              <input 
                className={`form-input${errors.nomorKK ? ' error' : ''}`} 
                value={form.nomorKK}
                onChange={e => !isEdit && set('nomorKK', e.target.value)} 
                placeholder="16 digit nomor KK" 
                maxLength={16}
                readOnly={isEdit}
                style={isEdit ? { background: '#f1f5f9', cursor: 'not-allowed' } : {}}
              />
            </Field>
            <Field name="kepalaKeluarga" label="Nama Kepala Keluarga" req>
              {isEdit && familyMembers && familyMembers.length > 0 ? (
                <select 
                  className={`form-input${errors.kepalaKeluarga ? ' error' : ''}`}
                  value={form.kepalaKeluarga}
                  onChange={e => set('kepalaKeluarga', e.target.value)}
                >
                  <option value="">Pilih dari anggota...</option>
                  {familyMembers.map(m => (
                    <option key={m.id} value={m.nama || m.namaLengkap || m.fullName}>
                      {m.nama || m.namaLengkap || m.fullName}
                    </option>
                  ))}
                </select>
              ) : (
                <input 
                  className={`form-input${errors.kepalaKeluarga ? ' error' : ''}`} 
                  value={form.kepalaKeluarga}
                  onChange={e => set('kepalaKeluarga', e.target.value)} 
                  placeholder="Nama lengkap"
                  disabled={isEdit && familyMembers && familyMembers.length > 0}
                />
              )}
            </Field>
            <Field name="blok" label="Blok" req>
              <select className="form-input" value={form.blok} onChange={e => set('blok', e.target.value)}>
                {"ABCDEFGHIJKLMNOPQRST".split("").map(b => <option key={b} value={b}>Blok {b}</option>)}
              </select>
            </Field>
            <Field name="nomorRumah" label="Nomor Rumah" req>
              <select className="form-input" value={form.nomorRumah} onChange={e => set('nomorRumah', e.target.value)}>
                <option value="">Pilih No...</option>
                {Array.from({length: 100}, (_, i) => i + 1).map(n => <option key={n} value={n.toString()}>{n}</option>)}
              </select>
            </Field>
            <Field name="rt" label="RT" req>
              <select className="form-input" value={form.rt} onChange={e => set('rt', e.target.value)}>
                {['001', '002', '003', '004', '005'].map(r => <option key={r} value={r}>RT {r}</option>)}
              </select>
            </Field>
            <Field name="rw" label="RW" req>
              <select className="form-input" value={form.rw} onChange={e => set('rw', e.target.value)} disabled>
                {['011'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSubmit}>{isEdit ? 'Simpan' : 'Tambah KK'}</button>
        </div>
      </div>
    </div>
  );
}
