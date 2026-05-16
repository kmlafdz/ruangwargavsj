import React, { useState, useEffect } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, 
  ArrowUpCircle, ArrowDownCircle,
  Search, Plus, Download, Filter,
  CreditCard, History, Clock, CheckCircle,
  AlertCircle, ChevronRight, ArrowRight,
  ShieldCheck, Smartphone, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { User } from '../types';

interface ResidentKeuanganProps {
  user: User;
}

export default function ResidentKeuangan({ user }: ResidentKeuanganProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(750000); // Mock balance
  const [stats, setStats] = useState({
    totalPaid: 0,
    unpaidCount: 0,
    currentMonthStatus: 'Lunas'
  });

  useEffect(() => {
    if (!user?.id) return;

    // Fetch personal transactions
    const q = query(
      collection(db, 'keuangan'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      
      // Calculate simple stats
      let paid = 0;
      let unpaid = 0;
      data.forEach((t: any) => {
        if (t.type === 'Iuran' && t.status === 'Paid') paid += t.amount || 0;
        if (t.status === 'Unpaid') unpaid++;
      });
      
      setStats({
        totalPaid: paid,
        unpaidCount: unpaid,
        currentMonthStatus: unpaid > 0 ? 'Ada Tunggakan' : 'Lunas'
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="resident-keuangan-container" style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
      <style>{`
        .resident-keuangan-container {
          font-family: 'Inter', sans-serif;
        }
        .rwallet-card {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          border-radius: 24px;
          padding: 24px;
          color: #fff;
          position: relative;
          overflow: hidden;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.2);
          margin-bottom: 24px;
        }
        .rwallet-card::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          border-radius: 50%;
        }
        .wallet-label {
          font-size: 13px;
          font-weight: 500;
          opacity: 0.8;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .wallet-balance {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -1px;
          margin-bottom: 24px;
        }
        .wallet-actions {
          display: flex;
          gap: 12px;
        }
        .wallet-btn {
          flex: 1;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .wallet-btn:hover {
          background: rgba(255,255,255,0.25);
          transform: translateY(-2px);
        }
        .wallet-btn span {
          font-size: 11px;
          font-weight: 700;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .section-header h3 {
          font-size: 17px;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
        }
        .section-header a {
          font-size: 12px;
          color: #2563eb;
          font-weight: 700;
          text-decoration: none;
        }

        .iuran-status-card {
          background: #fff;
          border-radius: 20px;
          padding: 20px;
          border: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .status-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .status-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-text .title {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }
        .status-text .subtitle {
          font-size: 11px;
          color: #64748b;
        }
        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
        }

        .transaction-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .transaction-item {
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          border: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s;
        }
        .transaction-item:active {
          transform: scale(0.98);
          background: #f8fafc;
        }
        .tx-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .tx-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tx-info .title {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 2px;
        }
        .tx-info .date {
          font-size: 11px;
          color: #94a3b8;
        }
        .tx-right {
          text-align: right;
        }
        .tx-amount {
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 2px;
        }
        .tx-status {
          font-size: 10px;
          font-weight: 700;
        }
      `}</style>

      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* RWallet Card */}
        <motion.div variants={itemVariants} className="rwallet-card">
          <div className="wallet-label">
            <Smartphone size={16} />
            <span>SALDO RWALLET</span>
          </div>
          <div className="wallet-balance">
            Rp {walletBalance.toLocaleString('id-ID')}
          </div>
          <div className="wallet-actions" style={{ justifyContent: 'center' }}>
            <button className="wallet-btn" style={{ maxWidth: '160px' }}>
              <Plus size={18} />
              <span>Isi Saldo</span>
            </button>
          </div>
        </motion.div>

        {/* Iuran Bulanan Section */}
        <div className="section-header">
          <h3>Tagihan Iuran</h3>
        </div>
        
        <motion.div variants={itemVariants} className="iuran-status-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="status-info">
              <div className="status-icon-box" style={{ 
                background: stats.currentMonthStatus === 'Lunas' ? '#f0fdf4' : stats.currentMonthStatus === 'Menunggu Verifikasi' ? '#fff7ed' : '#fef2f2', 
                color: stats.currentMonthStatus === 'Lunas' ? '#22c55e' : stats.currentMonthStatus === 'Menunggu Verifikasi' ? '#f59e0b' : '#ef4444' 
              }}>
                <CreditCard size={22} />
              </div>
              <div className="status-text">
                <div className="title" style={{ fontSize: 16, fontWeight: 800 }}>Iuran Bulanan</div>
                <div className="subtitle">Mei 2026</div>
              </div>
            </div>
            <div className="status-badge" style={{ 
              background: stats.currentMonthStatus === 'Lunas' ? '#dcfce7' : stats.currentMonthStatus === 'Menunggu Verifikasi' ? '#ffecda' : '#fee2e2', 
              color: stats.currentMonthStatus === 'Lunas' ? '#166534' : stats.currentMonthStatus === 'Menunggu Verifikasi' ? '#9a3412' : '#b91c1c',
              padding: '8px 14px', borderRadius: '12px'
            }}>
              {stats.currentMonthStatus.toUpperCase()}
            </div>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>NOMINAL</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#1e293b' }}>Rp 50.000</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>JATUH TEMPO</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: stats.currentMonthStatus === 'Lunas' ? '#64748b' : '#ef4444' }}>
                10 Mei 2026
              </div>
            </div>
          </div>

          {stats.currentMonthStatus !== 'Lunas' && (
            <button className="btn-premium" style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: 14, fontWeight: 700 }}>
              Bayar Sekarang
            </button>
          )}
        </motion.div>

        {/* Transaction History */}
        <div className="section-header">
          <h3>Riwayat Transaksi</h3>
          <a href="#">Lihat Semua</a>
        </div>

        <div className="transaction-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Memuat data...</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '40px 0', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <History size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>Belum ada transaksi</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Transaksi Anda akan muncul di sini.</div>
            </div>
          ) : (
            transactions.map((tx, idx) => (
              <motion.div 
                key={tx.id} 
                variants={itemVariants}
                className="transaction-item"
              >
                <div className="tx-left">
                  <div className="tx-icon" style={{ background: tx.type === 'Pemasukan' ? '#f0fdf4' : '#fef2f2', color: tx.type === 'Pemasukan' ? '#22c55e' : '#ef4444' }}>
                    {tx.type === 'Pemasukan' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                  </div>
                  <div className="tx-info">
                    <div className="title">{tx.description || tx.ket || 'Transaksi Keuangan'}</div>
                    <div className="date">{tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : 'Baru saja'}</div>
                  </div>
                </div>
                <div className="tx-right">
                  <div className="tx-amount" style={{ color: tx.type === 'Pemasukan' ? '#16a34a' : '#dc2626' }}>
                    {tx.type === 'Pemasukan' ? '+' : '-'} Rp {(tx.amount || 0).toLocaleString('id-ID')}
                  </div>
                  <div className="tx-status" style={{ color: tx.status === 'Paid' ? '#22c55e' : '#94a3b8' }}>
                    {tx.status || 'Success'}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
