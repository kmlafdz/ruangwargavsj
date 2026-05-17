import React from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/login/logo.png';

export default function SplashScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: "'Inter', sans-serif"
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ 
          position: 'relative', 
          marginBottom: 36, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          width: '100%' 
        }}>
          {/* Logo only, beautifully scaled up and animated */}
          <motion.img 
            src={logo} 
            alt="Logo" 
            animate={{ 
              y: [0, -6, 0]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ 
              width: 200, // Made beautifully large and clear
              height: 'auto', 
              position: 'relative', 
              zIndex: 1,
              display: 'block'
            }} 
          />
        </div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          style={{ 
            fontSize: 28, 
            fontWeight: 900, 
            color: '#1e3a8a',
            margin: 0,
            letterSpacing: -0.5
          }}
        >
          Ruang Warga VSJ
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1e3a8a',
            marginTop: 8,
            letterSpacing: 1,
            textTransform: 'uppercase'
          }}
        >
          Sinergi Warga, Solusi Digital Modern
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <div className="loader-dot" />
          <div className="loader-dot" style={{ animationDelay: '0.2s' }} />
          <div className="loader-dot" style={{ animationDelay: '0.4s' }} />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        style={{
          position: 'absolute',
          bottom: 40,
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
          VERSION 1.0.0-PRO
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', letterSpacing: 1 }}>
          © 2026 MUHAMMAD KEMAL AFRILIDZI
        </div>
      </motion.div>

      <style>{`
        .loader-dot {
          width: 6px;
          height: 6px;
          background: #3b82f6;
          borderRadius: 50%;
          animation: dot-pulse 1.4s infinite ease-in-out both;
        }
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0); opacity: 0; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
