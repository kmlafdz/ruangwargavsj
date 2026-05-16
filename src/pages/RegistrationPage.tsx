import React from 'react';
import { ShieldAlert, UserCheck, MessageCircle, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/login/logo.png';

export default function RegistrationPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ maxWidth: '500px', width: '100%', background: '#fff', borderRadius: '32px', padding: '48px', textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,0.3)' }}
      >
        <div style={{ width: '80px', height: '80px', background: '#eff6ff', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: '#3b82f6' }}>
          <ShieldAlert size={40} />
        </div>
        
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a', marginBottom: '16px' }}>Pendaftaran Tertutup</h1>
        <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: '40px' }}>
          Demi keamanan data warga RW 011 VSJ, pendaftaran akun mandiri telah dinonaktifkan. Akun warga kini dibuat langsung oleh <strong>Ketua RT atau Admin RW</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', background: '#f8fafc', padding: '24px', borderRadius: '20px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ color: '#3b82f6' }}><UserCheck size={20} /></div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>Aktivasi Akun</p>
              <p style={{ fontSize: '13px', color: '#64748b' }}>Jika sudah didaftarkan Admin, silakan login menggunakan NIK dan Tanggal Lahir Anda.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <div style={{ color: '#3b82f6' }}><MessageCircle size={20} /></div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>Hubungi Pengurus</p>
              <p style={{ fontSize: '13px', color: '#64748b' }}>Hubungi Ketua RT setempat untuk meminta pembuatan akun baru.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/warga-login')}
          style={{ width: '100%', height: '56px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <ChevronLeft size={18} /> Kembali ke Halaman Login
        </button>
      </motion.div>
    </div>
  );
}
