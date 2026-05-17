/**
 * KeuanganPage.tsx
 * Comprehensive Community Contribution & Billing Management System
 * Billed per Family Card (KK), integrating Resident, RT Admin & RW Admin workflows.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, Search, Plus, Download, 
  Filter, CreditCard, Clock, CheckCircle, AlertTriangle, 
  User, Check, X, Eye, FileText, Settings, RefreshCw, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  subscribeToBills, 
  subscribeToFamilyBills, 
  subscribeToPayments,
  createCustomBill, 
  autoGenerateMonthlyBills,
  verifyPayment, 
  rejectPayment,
  FamilyBill, 
  Payment,
  Bill 
} from '../services/financeService';

// Standard 12-month array
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface KeuanganPageProps {
  // Inject if available, otherwise fallback
  user?: any;
}

export default function KeuanganPage({ user }: KeuanganPageProps) {
  // Default fallback user if not passed (e.g. dev/admin role)
  const activeUser = useMemo(() => {
    if (user) return user;
    // Fallback Mock RW Admin for development
    return {
      id: 'admin_dev',
      name: 'Aditia RW 011',
      username: 'aditia_rw',
      accountType: 'admin',
      adminRole: 'rw', // 'rw' or 'rt'
      rt_id: '001',
      rw_id: '011'
    };
  }, [user]);

  const isRW = activeUser.adminRole === 'rw' || activeUser.adminRole === 'developer';
  const myRT = activeUser.rt_id;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'warga_kk' | 'verifikasi' | 'reports'>('overview');

  // Firestore Collections State
  const [bills, setBills] = useState<Bill[]>([]);
  const [familyBills, setFamilyBills] = useState<FamilyBill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [families, setFamilies] = useState<any[]>([]);

  // Search/Filter State
  const [searchKK, setSearchKK] = useState('');
  const [filterRT, setFilterRT] = useState(isRW ? '' : myRT);
  const [filterStatus, setFilterStatus] = useState('');
  
  // Custom Bill Form State
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [newBillData, setNewBillData] = useState({
    title: '',
    category: 'Iuran Bulanan',
    amount: '',
    dueDate: '',
    targetType: 'all' as 'all' | 'rt' | 'kk',
    targetValue: 'all'
  });
  const [isCreatingBill, setIsCreatingBill] = useState(false);

  // Manual payment rejection modal
  const [rejectingPaymentItem, setRejectingPaymentItem] = useState<{ pId: string; fbId: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Selected Family detail view modal
  const [selectedFamilyDetail, setSelectedFamilyDetail] = useState<any | null>(null);

  // Live image lightbox
  const [activeProofLightbox, setActiveProofLightbox] = useState<string | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Families & Residents to assign bills and match names
  useEffect(() => {
    const qFam = query(collection(db, 'families'), orderBy('updatedAt', 'desc'));
    const unsubFam = onSnapshot(qFam, (snap) => {
      setFamilies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubFam;
  }, []);

  // 2. Real-time subscriptions for Bills, FamilyBills, Payments
  useEffect(() => {
    const unsubBills = subscribeToBills(setBills);
    
    // Filter on Firestore or dynamic client side depending on roles
    const filterParams = isRW ? {} : { rt: myRT };
    const unsubFamilyBills = subscribeToFamilyBills(filterParams, setFamilyBills);
    const unsubPayments = subscribeToPayments(filterParams, setPayments);

    return () => {
      unsubBills();
      unsubFamilyBills();
      unsubPayments();
    };
  }, [isRW, myRT]);

  // Dynamic Statistics Computations
  const stats = useMemo(() => {
    const filteredFB = isRW && filterRT ? familyBills.filter(fb => fb.rt === filterRT) : familyBills;
    const filteredPayments = isRW && filterRT ? payments.filter(p => p.rt === filterRT) : payments;

    const totalKas = filteredPayments
      .filter(p => p.status === 'APPROVED')
      .reduce((sum, p) => sum + p.amount, 0);

    const approvedThisMonth = filteredPayments
      .filter(p => {
        if (p.status !== 'APPROVED') return false;
        const pDate = p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date();
        const now = new Date();
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const totalTunggakan = filteredFB
      .filter(fb => fb.status === 'BELUM BAYAR' || fb.status === 'MENUNGGAK')
      .reduce((sum, fb) => sum + fb.amount, 0);

    const countLunas = filteredFB.filter(fb => fb.status === 'LUNAS').length;
    const totalBillsCount = filteredFB.length;
    const percentageLunas = totalBillsCount > 0 ? Math.round((countLunas / totalBillsCount) * 100) : 100;

    const countPendingVerif = filteredPayments.filter(p => p.status === 'PENDING').length;

    return {
      totalKas,
      approvedThisMonth,
      totalTunggakan,
      percentageLunas,
      countPendingVerif,
      totalBillsCount,
      countLunas
    };
  }, [familyBills, payments, filterRT, isRW]);

  // Generate automated monthly billing for current month
  const handleAutoGenerate = async () => {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // RW or Dev only can trigger auto-billing
    if (!isRW) {
      showToast('Hanya RW Admin yang dapat memicu pembuatan iuran otomatis.', 'error');
      return;
    }

    try {
      const generated = await autoGenerateMonthlyBills(currentMonthYear, families);
      if (generated) {
        showToast(`Sukses membuat Iuran Bulanan otomatis untuk ${currentMonthYear}`, 'success');
      } else {
        showToast(`Iuran Bulanan untuk ${currentMonthYear} sudah diterbitkan sebelumnya.`, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memicu tagihan otomatis', 'error');
    }
  };

  // Create custom bill
  const handleCreateCustomBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillData.title || !newBillData.amount || !newBillData.dueDate) {
      showToast('Mohon lengkapi semua field tagihan', 'error');
      return;
    }

    setIsCreatingBill(true);
    try {
      await createCustomBill({
        title: newBillData.title,
        category: newBillData.category,
        amount: parseInt(newBillData.amount),
        dueDate: newBillData.dueDate,
        targetType: newBillData.targetType,
        targetValue: newBillData.targetValue
      }, families);

      showToast(`Sukses membuat tagihan "${newBillData.title}"!`, 'success');
      setShowCreateBillModal(false);
      setNewBillData({
        title: '',
        category: 'Iuran Bulanan',
        amount: '',
        dueDate: '',
        targetType: 'all',
        targetValue: 'all'
      });
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat tagihan custom', 'error');
    } finally {
      setIsCreatingBill(false);
    }
  };

  // Verify payment action
  const handleApprovePayment = async (pId: string, fbId: string) => {
    try {
      await verifyPayment(pId, fbId, activeUser.name);
      showToast('Pembayaran berhasil dikonfirmasi lunas!', 'success');
    } catch (err: any) {
      showToast('Gagal memverifikasi pembayaran', 'error');
    }
  };

  // Reject payment action
  const handleRejectPaymentSubmit = async () => {
    if (!rejectingPaymentItem || !rejectionReason) return;
    try {
      await rejectPayment(rejectingPaymentItem.pId, rejectingPaymentItem.fbId, activeUser.name, rejectionReason);
      showToast('Pembayaran ditolak dan warga telah dinotifikasi.', 'success');
      setRejectingPaymentItem(null);
      setRejectionReason('');
    } catch (err: any) {
      showToast('Gagal menolak pembayaran', 'error');
    }
  };

  // Dynamic filter for KK list & tracking table
  const filteredFamilies = useMemo(() => {
    return families.filter(f => {
      const rtMatch = isRW ? (!filterRT || f.rt === filterRT) : (f.rt === myRT);
      const searchMatch = !searchKK || 
        f.nomorKK.includes(searchKK) || 
        (f.kepalaKeluarga || '').toLowerCase().includes(searchKK.toLowerCase());
      return rtMatch && searchMatch;
    });
  }, [families, isRW, filterRT, myRT, searchKK]);

  // Export reports to Excel (CSV format)
  const exportToExcel = () => {
    const headers = ['Nomor KK', 'Kepala Keluarga', 'RT/RW', 'Total Tagihan', 'Total Terbayar', 'Sisa Tunggakan', 'Status'];
    const rows = filteredFamilies.map(f => {
      const myBills = familyBills.filter(fb => fb.nomorKK === f.nomorKK);
      const totalAmount = myBills.reduce((acc, b) => acc + b.amount, 0);
      const totalPaid = myBills.filter(b => b.status === 'LUNAS').reduce((acc, b) => acc + b.amount, 0);
      const outstanding = totalAmount - totalPaid;
      const statusText = outstanding === 0 ? 'Lunas' : outstanding === totalAmount ? 'Belum Bayar' : 'Ada Tunggakan';
      
      return [
        f.nomorKK,
        f.kepalaKeluarga,
        `RT ${f.rt} / RW 011`,
        totalAmount,
        totalPaid,
        outstanding,
        statusText
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Keuangan_VSJ_RT${filterRT || 'Semua'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Laporan Excel berhasil diunduh!', 'success');
  };

  return (
    <div className="keuangan-page-container">
      <style>{`
        .keuangan-page-container {
          padding: 24px;
          color: #1e293b;
        }
        .action-buttons-group-premium {
          display: flex;
          gap: 8px;
        }
        .stats-grid-premium {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        .stat-card-premium {
          background: #fff;
          border-radius: 24px;
          padding: 24px;
          border: 1px solid #f1f5f9;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.01), 0 4px 6px -4px rgba(0, 0, 0, 0.01);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .stat-card-premium:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.05);
        }
        .stat-card-premium::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 4px; height: 100%;
        }
        .stat-card-premium.blue::before { background: #2563eb; }
        .stat-card-premium.green::before { background: #10b981; }
        .stat-card-premium.red::before { background: #ef4444; }
        .stat-card-premium.yellow::before { background: #f59e0b; }

        .icon-box {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
        }
        .blue .icon-box { background: #eff6ff; color: #2563eb; }
        .green .icon-box { background: #ecfdf5; color: #10b981; }
        .red .icon-box { background: #fef2f2; color: #ef4444; }
        .yellow .icon-box { background: #fffbeb; color: #f59e0b; }

        .stat-val {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 2px;
        }
        .stat-lbl {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .tab-menu {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 24px;
          overflow-x: auto;
          gap: 8px;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .tab-menu::-webkit-scrollbar {
          display: none;
        }
        .tab-btn {
          padding: 10px 18px;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          border-radius: 10px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .tab-btn.active {
          color: #2563eb;
          background: #eff6ff;
        }

        .card-premium {
          background: #fff;
          border-radius: 28px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
          overflow: hidden;
        }
        .card-header-premium {
          padding: 24px 32px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .card-body-premium {
          padding: 32px;
        }

        .matrix-table {
          width: 100%;
          border-collapse: collapse;
        }
        .matrix-table th {
          padding: 12px 8px;
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          border-bottom: 1px solid #f1f5f9;
        }
        .matrix-table td {
          padding: 14px 8px;
          border-bottom: 1px solid #f8fafc;
          font-size: 12px;
        }
        .matrix-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 900;
          margin: 0 auto;
        }
        .matrix-dot.lunas { background: #dcfce7; color: #15803d; }
        .matrix-dot.pending { background: #fff7ed; color: #c2410c; }
        .matrix-dot.tunggakan { background: #fef2f2; color: #b91c1c; }
        .matrix-dot.belum { background: #f1f5f9; color: #64748b; }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .form-group-premium {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group-premium label {
          font-size: 12px;
          font-weight: 800;
          color: #475569;
        }
        .form-input-premium {
          height: 44px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 14px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
        }
        .form-input-premium:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .pending-card {
          border: 1px solid #f1f5f9;
          border-radius: 20px;
          padding: 20px;
          background: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.01);
        }
        .pending-thumb {
          width: 80px;
          height: 80px;
          border-radius: 12px;
          object-fit: cover;
          cursor: zoom-in;
          border: 1px solid #e2e8f0;
        }

        @media (max-width: 768px) {
          .keuangan-page-container {
            padding: 12px;
          }
          .keuangan-page-container h2 {
            font-size: 20px !important;
          }
          .action-buttons-group-premium {
            width: 100%;
            display: flex;
            gap: 8px;
            margin-top: 8px;
          }
          .action-buttons-group-premium .btn {
            flex: 1;
            font-size: 11px !important;
            padding: 0 8px !important;
            height: 38px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .stats-grid-premium {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 16px;
          }
          .stat-card-premium {
            padding: 12px 14px !important;
            border-radius: 18px !important;
            gap: 10px !important;
          }
          .stat-card-premium::before {
            width: 3px !important;
          }
          .stat-card-premium .icon-box {
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
          }
          .stat-card-premium .icon-box svg {
            width: 16px !important;
            height: 16px !important;
          }
          .stat-val {
            font-size: 13px !important;
            font-weight: 800 !important;
          }
          .stat-lbl {
            font-size: 9px !important;
            line-height: 1.2;
          }
          .tab-menu {
            margin-bottom: 16px;
          }
          .tab-btn {
            padding: 8px 12px !important;
            font-size: 11px !important;
          }
          .card-header-premium {
            padding: 16px !important;
            gap: 12px !important;
          }
          .card-body-premium {
            padding: 16px !important;
          }
        }
      `}</style>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -20, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -20, opacity: 0, x: '-50%' }}
            style={{
              position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 11000,
              background: '#0f172a', color: '#fff', borderRadius: 16, padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)'
            }}
          >
            {toast.type === 'success' ? <CheckCircle size={16} style={{ color: '#22c55e' }} /> : <AlertTriangle size={16} style={{ color: '#ef4444' }} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Keuangan Warga VSJ</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Hak Akses: <b>{activeUser.adminRole.toUpperCase()} Admin</b> {activeUser.adminRole === 'rt' ? `RT ${activeUser.rt_id}` : ''}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="action-buttons-group-premium">
          <button className="btn btn-secondary" onClick={() => setActiveTab('reports')}>
            <Download size={14} /> Ekspor Data
          </button>
          {isRW && (
            <button className="btn btn-primary" onClick={handleAutoGenerate}>
              <RefreshCw size={14} /> Picu Tagihan Bulanan Mei
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Statistics Cards Grid */}
      <div className="stats-grid-premium">
        <div className="stat-card-premium blue">
          <div className="icon-box"><Wallet size={22} /></div>
          <div>
            <div className="stat-val">Rp {stats.totalKas.toLocaleString('id-ID')}</div>
            <div className="stat-lbl">Saldo Kas ({isRW ? 'RW 011' : `RT ${myRT}`})</div>
          </div>
        </div>
        <div className="stat-card-premium green">
          <div className="icon-box"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-val">Rp {stats.approvedThisMonth.toLocaleString('id-ID')}</div>
            <div className="stat-lbl">Pemasukan Bulan Ini</div>
          </div>
        </div>
        <div className="stat-card-premium red">
          <div className="icon-box"><TrendingDown size={22} /></div>
          <div>
            <div className="stat-val">Rp {stats.totalTunggakan.toLocaleString('id-ID')}</div>
            <div className="stat-lbl">Total Tunggakan Aktif</div>
          </div>
        </div>
        <div className="stat-card-premium yellow">
          <div className="icon-box"><Clock size={22} /></div>
          <div>
            <div className="stat-val">{stats.countPendingVerif} Struk</div>
            <div className="stat-lbl">Menunggu Verifikasi</div>
          </div>
        </div>
      </div>

      {/* Tab Menu Header */}
      <div className="tab-menu">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <BarChart2 size={14} style={{ display: 'inline', marginRight: 6 }} /> Ikhtisar
        </button>
        <button className={`tab-btn ${activeTab === 'bills' ? 'active' : ''}`} onClick={() => setActiveTab('bills')}>
          <CreditCard size={14} style={{ display: 'inline', marginRight: 6 }} /> Manajemen Tagihan
        </button>
        <button className={`tab-btn ${activeTab === 'warga_kk' ? 'active' : ''}`} onClick={() => setActiveTab('warga_kk')}>
          <User size={14} style={{ display: 'inline', marginRight: 6 }} /> Bulanan KK (Matrix 12 Bulan)
        </button>
        <button className={`tab-btn ${activeTab === 'verifikasi' ? 'active' : ''}`} onClick={() => setActiveTab('verifikasi')}>
          <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} /> Verifikasi Bukti
        </button>
        <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          <FileText size={14} style={{ display: 'inline', marginRight: 6 }} /> Laporan & Ekspor
        </button>
      </div>

      {/* TAB CONTENTS */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Ringkasan Partisipasi Iuran</h3>
                <p className="card-subtitle-premium">Rasio pembayaran tagihan warga secara keseluruhan</p>
              </div>
            </div>
            <div className="card-body-premium">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 40, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9', paddingRight: 40 }}>
                  <div style={{ fontSize: 64, fontWeight: 900, color: '#2563eb' }}>{stats.percentageLunas}%</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 10 }}>Tingkat Partisipasi (Lunas)</div>
                  <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                    Dari total {stats.totalBillsCount} tagihan terbit, sebanyak {stats.countLunas} telah terlunasi dengan baik.
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 16 }}>Daftar Pembayaran Terkini</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {payments.slice(0, 4).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f8fafc', paddingBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{p.kepalaKeluarga} (KK)</div>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>RT {p.rt} • {p.paymentMethod}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#10b981' }}>Rp {p.amount.toLocaleString('id-ID')}</div>
                          <span style={{ fontSize: 10, color: p.status === 'APPROVED' ? '#10b981' : '#f59e0b', fontWeight: 800 }}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                    {payments.length === 0 && (
                      <div style={{ color: '#94a3b8', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Belum ada transaksi pembayaran masuk.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'bills' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Daftar Master Tagihan VSJ</h3>
                <p className="card-subtitle-premium">Kelola atau buat tagihan iuran khusus di wilayah RW 011</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCreateBillModal(true)}>
                <Plus size={16} /> Buat Tagihan Baru
              </button>
            </div>
            <div className="card-body-premium" style={{ padding: 0 }}>
              <table className="matrix-table" style={{ textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 32 }}>Nama Tagihan</th>
                    <th>Kategori</th>
                    <th>Nominal</th>
                    <th>Jatuh Tempo</th>
                    <th>Target Area</th>
                    <th>Tanggal Terbit</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(b => (
                    <tr key={b.id}>
                      <td style={{ paddingLeft: 32, fontWeight: 800 }}>{b.title}</td>
                      <td><span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{b.category}</span></td>
                      <td style={{ fontWeight: 800 }}>Rp {b.amount.toLocaleString('id-ID')}</td>
                      <td>{b.dueDate}</td>
                      <td style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700 }}>
                        {b.targetType === 'all' ? 'Semua Warga' : b.targetType === 'rt' ? `RT ${b.targetValue}` : `No. KK ${b.targetValue}`}
                      </td>
                      <td>{b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString('id-ID') : 'Baru saja'}</td>
                    </tr>
                  ))}
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 48 }}>Belum ada master tagihan terbuat.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'warga_kk' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Pelacakan Matrix Bulanan KK</h3>
                <p className="card-subtitle-premium">Status pembayaran iuran bulanan tahun berjalan per Kepala Keluarga</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="search-box">
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    placeholder="Cari KK / Kepala Keluarga..." 
                    value={searchKK} onChange={e => setSearchKK(e.target.value)}
                    style={{ border: '1px solid #cbd5e1', height: 38, borderRadius: 10, paddingLeft: 34, fontSize: 12, outline: 'none' }}
                  />
                </div>
                {isRW && (
                  <select 
                    value={filterRT} onChange={e => setFilterRT(e.target.value)}
                    style={{ border: '1px solid #cbd5e1', height: 38, borderRadius: 10, padding: '0 10px', fontSize: 12, fontWeight: 700 }}
                  >
                    <option value="">Semua RT</option>
                    {['001', '002', '003', '004', '005'].map(rt => <option key={rt} value={rt}>RT {rt}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="card-body-premium" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="matrix-table" style={{ width: '100%', minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 32, textAlign: 'left', minWidth: 150 }}>Kepala Keluarga</th>
                    <th>RT</th>
                    {/* Render Month Shortnames */}
                    {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'].map(m => (
                      <th key={m} style={{ textAlign: 'center' }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFamilies.map((fam) => {
                    const myFamilyBills = familyBills.filter(fb => fb.nomorKK === fam.nomorKK);
                    return (
                      <tr key={fam.id} onClick={() => setSelectedFamilyDetail(fam)} style={{ cursor: 'pointer' }}>
                        <td style={{ paddingLeft: 32, textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, color: '#334155' }}>{fam.kepalaKeluarga}</div>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{fam.nomorKK}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#6366f1' }}>RT {fam.rt}</td>
                        {/* 12 Months tracking matrix */}
                        {Array.from({ length: 12 }).map((_, i) => {
                          const monthStr = `2026-${String(i + 1).padStart(2, '0')}`;
                          const monthBill = myFamilyBills.find(b => b.category === 'Iuran Bulanan' && b.dueDate.startsWith(monthStr));
                          
                          if (!monthBill) return <td key={i} style={{ textAlign: 'center', color: '#cbd5e1' }}>-</td>;
                          
                          let badgeClass = 'belum';
                          let label = 'B';
                          if (monthBill.status === 'LUNAS') { badgeClass = 'lunas'; label = 'L'; }
                          else if (monthBill.status === 'MENUNGGU VERIFIKASI') { badgeClass = 'pending'; label = 'V'; }
                          else if (new Date(monthBill.dueDate) < new Date()) { badgeClass = 'tunggakan'; label = 'M'; }
                          
                          return (
                            <td key={i} style={{ textAlign: 'center' }}>
                              <div className={`matrix-dot ${badgeClass}`} title={`${monthBill.title}: ${monthBill.status}`}>
                                {label}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {filteredFamilies.length === 0 && (
                    <tr>
                      <td colSpan={14} style={{ textAlign: 'center', color: '#94a3b8', padding: 48 }}>Tidak ada data warga ditemukan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'verifikasi' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Verifikasi Bukti Transfer Warga</h3>
                <p className="card-subtitle-premium">Tinjau struk pembayaran digital warga dan konfirmasi kas masuk</p>
              </div>
            </div>
            <div className="card-body-premium">
              {payments.filter(p => p.status === 'PENDING').map((p) => {
                const bill = bills.find(b => b.id === p.billId);
                return (
                  <div key={p.id} className="pending-card">
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      {p.proofImage ? (
                        <img 
                          src={p.proofImage} 
                          alt="Struk Transfer" 
                          className="pending-thumb" 
                          onClick={() => setActiveProofLightbox(p.proofImage || null)}
                        />
                      ) : (
                        <div style={{ width: 80, height: 80, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          No Image
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{p.kepalaKeluarga}</div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          KK: {p.nomorKK} • RT {p.rt} / 011
                        </span>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                          Tagihan: {bill?.title || 'Iuran Bulanan'} (Rp {p.amount.toLocaleString('id-ID')})
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          Dikirim: {p.paymentDate?.toDate ? p.paymentDate.toDate().toLocaleString('id-ID') : 'Baru saja'} via {p.paymentMethod}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRejectingPaymentItem({ pId: p.id, fbId: p.familyBillId })}>
                        <X size={14} /> Tolak Struk
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApprovePayment(p.id, p.familyBillId)}>
                        <Check size={14} /> Konfirmasi Lunas
                      </button>
                    </div>
                  </div>
                );
              })}
              {payments.filter(p => p.status === 'PENDING').length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                  <CheckCircle size={32} style={{ color: '#22c55e', margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Semua pembayaran bersih terverifikasi!</div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Laporan Konsolidasi Iuran</h3>
                <p className="card-subtitle-premium">Ekspor rekapitulasi data tagihan & tunggakan warga</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={exportToExcel}>
                  <Download size={14} /> Ekspor Excel (CSV)
                </button>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  <FileText size={14} /> Cetak Laporan (PDF)
                </button>
              </div>
            </div>
            <div className="card-body-premium" style={{ padding: 0 }}>
              <table className="matrix-table" style={{ textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 32 }}>Kepala Keluarga</th>
                    <th>Nomor KK</th>
                    <th>RT/RW</th>
                    <th>Total Tagihan</th>
                    <th>Total Terbayar</th>
                    <th>Sisa Tunggakan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFamilies.map((f) => {
                    const myBills = familyBills.filter(fb => fb.nomorKK === f.nomorKK);
                    const totalAmount = myBills.reduce((acc, b) => acc + b.amount, 0);
                    const totalPaid = myBills.filter(b => b.status === 'LUNAS').reduce((acc, b) => acc + b.amount, 0);
                    const outstanding = totalAmount - totalPaid;
                    return (
                      <tr key={f.id}>
                        <td style={{ paddingLeft: 32, fontWeight: 800 }}>{f.kepalaKeluarga}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{f.nomorKK}</td>
                        <td style={{ fontWeight: 600 }}>RT {f.rt} / 011</td>
                        <td>Rp {totalAmount.toLocaleString('id-ID')}</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>Rp {totalPaid.toLocaleString('id-ID')}</td>
                        <td style={{ color: outstanding > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>Rp {outstanding.toLocaleString('id-ID')}</td>
                        <td>
                          <span className={`status-badge-premium ${outstanding === 0 ? 'active' : 'inactive'}`}>
                            {outstanding === 0 ? 'Lunas' : 'Belum Lunas'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE BILL MODAL */}
      <AnimatePresence>
        {showCreateBillModal && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h2 className="modal-title">Buat Tagihan Baru</h2>
                <button className="close-btn" onClick={() => setShowCreateBillModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateCustomBillSubmit}>
                <div className="modal-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group-premium">
                      <label>Judul Tagihan</label>
                      <input 
                        type="text" className="form-input-premium" 
                        placeholder="Contoh: Iuran Keamanan Mei 2026" 
                        value={newBillData.title} onChange={e => setNewBillData({...newBillData, title: e.target.value})}
                        required 
                      />
                    </div>

                    <div className="form-grid">
                      <div className="form-group-premium">
                        <label>Kategori Iuran</label>
                        <select 
                          className="form-input-premium"
                          value={newBillData.category} onChange={e => setNewBillData({...newBillData, category: e.target.value})}
                        >
                          <option value="Iuran Bulanan">Iuran Bulanan</option>
                          <option value="Iuran Keamanan">Iuran Keamanan</option>
                          <option value="Iuran Kebersihan">Iuran Kebersihan</option>
                          <option value="Iuran Kegiatan">Iuran Kegiatan</option>
                          <option value="Donasi / Amal">Donasi / Amal</option>
                          <option value="Special Event">Special Event</option>
                        </select>
                      </div>
                      <div className="form-group-premium">
                        <label>Nominal (Rp)</label>
                        <input 
                          type="number" className="form-input-premium" 
                          placeholder="Contoh: 50000" 
                          value={newBillData.amount} onChange={e => setNewBillData({...newBillData, amount: e.target.value})}
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group-premium">
                        <label>Jatuh Tempo</label>
                        <input 
                          type="date" className="form-input-premium" 
                          value={newBillData.dueDate} onChange={e => setNewBillData({...newBillData, dueDate: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="form-group-premium">
                        <label>Target Sasaran Area</label>
                        <select 
                          className="form-input-premium"
                          value={newBillData.targetType} onChange={e => setNewBillData({...newBillData, targetType: e.target.value as any})}
                        >
                          <option value="all">Semua KK (Se-RW 011)</option>
                          <option value="rt">Berdasarkan RT Tertentu</option>
                          <option value="kk">Keluarga Tertentu (KK Spesifik)</option>
                        </select>
                      </div>
                    </div>

                    {newBillData.targetType === 'rt' && (
                      <div className="form-group-premium">
                        <label>Pilih RT Sasaran</label>
                        <select 
                          className="form-input-premium"
                          value={newBillData.targetValue} onChange={e => setNewBillData({...newBillData, targetValue: e.target.value})}
                        >
                          <option value="001">RT 001</option>
                          <option value="002">RT 002</option>
                          <option value="003">RT 003</option>
                          <option value="004">RT 004</option>
                          <option value="005">RT 005</option>
                        </select>
                      </div>
                    )}

                    {newBillData.targetType === 'kk' && (
                      <div className="form-group-premium">
                        <label>Masukkan Nomor KK Sasaran</label>
                        <input 
                          type="text" className="form-input-premium" 
                          placeholder="Contoh: 3273..."
                          value={newBillData.targetValue === 'all' ? '' : newBillData.targetValue} 
                          onChange={e => setNewBillData({...newBillData, targetValue: e.target.value})}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateBillModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={isCreatingBill}>
                    {isCreatingBill ? 'Memproses...' : 'Terbitkan Tagihan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL REJECTION REASON MODAL */}
      <AnimatePresence>
        {rejectingPaymentItem && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h2 className="modal-title">Alasan Penolakan Pembayaran</h2>
                <button className="close-btn" onClick={() => setRejectingPaymentItem(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group-premium">
                  <label>Tuliskan alasan penolakan agar warga dapat mengetahuinya</label>
                  <textarea 
                    className="form-input-premium" 
                    placeholder="Contoh: Bukti transfer tidak jelas / nominal tidak sesuai."
                    value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                    style={{ height: 100, paddingTop: 10 }}
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setRejectingPaymentItem(null)}>Batal</button>
                <button className="btn btn-primary" onClick={handleRejectPaymentSubmit} style={{ background: '#ef4444' }}>Kirim Penolakan</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* FAMILY DETAILED MATRIX VIEW MODAL */}
      <AnimatePresence>
        {selectedFamilyDetail && (
          <div className="modal-overlay" onClick={() => setSelectedFamilyDetail(null)}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Info Detil Keuangan Warga</h2>
                <button className="close-btn" onClick={() => setSelectedFamilyDetail(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                    <User size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{selectedFamilyDetail.kepalaKeluarga}</h3>
                    <span style={{ fontSize: 12, color: '#64748b' }}>No. KK: {selectedFamilyDetail.nomorKK} • RT {selectedFamilyDetail.rt} / 011</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 12 }}>Daftar Tagihan Berjalan</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {familyBills.filter(fb => fb.nomorKK === selectedFamilyDetail.nomorKK).map(fb => (
                      <div key={fb.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span>{fb.title}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 800 }}>Rp {fb.amount.toLocaleString('id-ID')}</span>
                          <span className={`status-badge-premium ${fb.status === 'LUNAS' ? 'active' : 'inactive'}`}>{fb.status}</span>
                        </div>
                      </div>
                    ))}
                    {familyBills.filter(fb => fb.nomorKK === selectedFamilyDetail.nomorKK).length === 0 && (
                      <div style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'center' }}>Belum ada iuran diterbitkan untuk KK ini.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedFamilyDetail(null)}>Tutup</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX FOR RECEIPT PROOF IMAGE */}
      <AnimatePresence>
        {activeProofLightbox && (
          <div className="modal-overlay" style={{ zIndex: 12000, background: 'rgba(15,23,42,0.9)' }} onClick={() => setActiveProofLightbox(null)}>
            <div style={{ position: 'relative', width: '90%', maxHeight: '90%' }}>
              <img src={activeProofLightbox} alt="Lightbox proof" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 16 }} />
              <button 
                onClick={() => setActiveProofLightbox(null)}
                style={{ position: 'absolute', top: -32, right: 0, border: 'none', background: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
              >
                ✕ Close Preview
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
