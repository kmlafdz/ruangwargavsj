import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Family } from '../types';

interface FamilyFormModalProps {
  family: Family | null;
  allFamilies: Family[];
  onSave: (data: any) => void;
  onClose: () => void;
}

const EMPTY = { nomorKK: '', kepalaKeluarga: '', alamat: '', rt: '01', rw: '05' };

export default function FamilyFormModal({ family, allFamilies, onSave, onClose }: FamilyFormModalProps) {
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
    if (!form.alamat.trim()) e.alamat = 'Alamat wajib diisi';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ 
      ...form, 
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
                onChange={e => set('nomorKK', e.target.value)} 
                placeholder="16 digit nomor KK" 
                maxLength={16}
              />
            </Field>
            <Field name="kepalaKeluarga" label="Nama Kepala Keluarga" req>
              <input 
                className={`form-input${errors.kepalaKeluarga ? ' error' : ''}`} 
                value={form.kepalaKeluarga}
                onChange={e => set('kepalaKeluarga', e.target.value)} 
                placeholder="Nama lengkap"
              />
            </Field>
            <Field name="rt" label="RT" req>
              <select className="form-input" value={form.rt} onChange={e => set('rt', e.target.value)}>
                {['01', '02', '03', '04', '05'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field name="rw" label="RW" req>
              <select className="form-input" value={form.rw} onChange={e => set('rw', e.target.value)}>
                {['05'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field name="alamat" label="Alamat Lengkap" req>
              <textarea 
                className={`form-input${errors.alamat ? ' error' : ''}`} 
                rows={2}
                value={form.alamat} 
                onChange={e => set('alamat', e.target.value)}
                placeholder="Jl. ..., No." 
                style={{ resize: 'vertical' }}
              />
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
