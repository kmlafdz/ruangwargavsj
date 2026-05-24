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
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import SensitiveDataViewer from '../components/SensitiveDataViewer';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, Timestamp, where } from 'firebase/firestore';
import { 
  subscribeToBills, 
  subscribeToFamilyBills, 
  subscribeToPayments,
  createCustomBill, 
  autoGenerateMonthlyBills,
  verifyPayment, 
  rejectPayment,
  payBillManually,
  savePaymentSettings,
  getPaymentSettings,
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
  const isRWOnly = activeUser.adminRole === 'rw';
  const myRT = activeUser.rt_id;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'warga_kk' | 'verifikasi' | 'reports' | 'quick_lunas' | 'settings'>('overview');

  // Quick Lunas State
  const [searchQuickLunas, setSearchQuickLunas] = useState('');
  const [selectedFamilyQL, setSelectedFamilyQL] = useState<any | null>(null);
  const [selectedBillQL, setSelectedBillQL] = useState<string>('');
  const [isProcessingQL, setIsProcessingQL] = useState(false);

  // Firestore Collections State
  const [bills, setBills] = useState<Bill[]>([]);
  const [familyBills, setFamilyBills] = useState<FamilyBill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [rtAdmins, setRtAdmins] = useState<any[]>([]);

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
    targetType: 'all' as 'all' | 'rt' | 'kk' | 'rt_admin',
    targetValue: 'all'
  });
  const [isCreatingBill, setIsCreatingBill] = useState(false);

  // Manual payment rejection modal
  const [rejectingPaymentItem, setRejectingPaymentItem] = useState<{ pId: string; fbId: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Selected Family detail view modal
  const [selectedFamilyDetail, setSelectedFamilyDetail] = useState<any | null>(null);

  // Setoran RT to RW manual payment processing state
  const [isProcessingSetoranLunas, setIsProcessingSetoranLunas] = useState<string | null>(null);

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

  // Fetch RT Admin details dynamically
  useEffect(() => {
    if (!isRW) return;
    const q = query(
      collection(db, 'users'),
      where('accountType', '==', 'admin'),
      where('adminRole', '==', 'rt')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRtAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [isRW]);

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

  useEffect(() => {
    if (isRWOnly && (activeTab === 'quick_lunas' || activeTab === 'warga_kk' || activeTab === 'reports')) {
      setActiveTab('overview');
    }
  }, [isRWOnly, activeTab]);

  // Dynamic Statistics Computations
  const stats = useMemo(() => {
    let filteredFB = familyBills;
    let filteredPayments = payments;

    if (isRWOnly) {
      filteredFB = familyBills.filter(fb => fb.category === 'Setoran Kas RT ke RW');
      filteredPayments = payments.filter(p => {
        const bill = bills.find(b => b.id === p.billId);
        return bill?.category === 'Setoran Kas RT ke RW';
      });
    } else if (isRW && filterRT) {
      filteredFB = familyBills.filter(fb => fb.rt === filterRT);
      filteredPayments = payments.filter(p => p.rt === filterRT);
    }

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
  }, [familyBills, payments, filterRT, isRW, isRWOnly, bills]);

  // Group Setoran Kas RT ke RW by RT Admin for RW Admin overview
  const rtSetoranOverview = useMemo(() => {
    if (activeUser.adminRole !== 'rw') return [];
    const rts = ['001', '002', '003', '004', '005'];
    const setoranBills = familyBills.filter(fb => fb.category === 'Setoran Kas RT ke RW');

    return rts.map(rtId => {
      const adminUser = rtAdmins.find(u => u.rt_id === rtId);
      const myBills = setoranBills.filter(fb => fb.rt === rtId);

      return {
        rtId,
        adminName: adminUser ? adminUser.name : `Ketua RT ${rtId}`,
        username: adminUser ? adminUser.username : null,
        phoneNumber: adminUser ? adminUser.phoneNumber : null,
        bills: myBills
      };
    }).filter(item => item.bills.length > 0);
  }, [familyBills, rtAdmins, activeUser.adminRole]);

  const pendingPaymentsForVerif = useMemo(() => {
    let list = payments.filter(p => p.status === 'PENDING');
    if (isRWOnly) {
      list = list.filter(p => {
        const bill = bills.find(b => b.id === p.billId);
        return bill?.category === 'Setoran Kas RT ke RW';
      });
    }
    return list;
  }, [payments, isRWOnly, bills]);

  // Filter master bills so RW Admin only sees setoran category
  const filteredMasterBills = useMemo(() => {
    return bills.filter(b => !isRWOnly || b.category === 'Setoran Kas RT ke RW');
  }, [bills, isRWOnly]);

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
        targetType: activeUser.adminRole === 'developer' ? 'all' : (isRW ? 'rt_admin' : 'rt'),
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

  // Quick Lunas Family Search
  const quickLunasFamilies = useMemo(() => {
    if (!searchQuickLunas.trim()) return [];
    const q = searchQuickLunas.toLowerCase();
    return families.filter(f => {
      const rtMatch = isRW ? true : (f.rt === myRT);
      const searchMatch = 
        f.nomorKK.includes(q) || 
        (f.kepalaKeluarga || '').toLowerCase().includes(q) || 
        (f.alamat || '').toLowerCase().includes(q) ||
        (f.blok ? `blok ${f.blok} no. ${f.nomorRumah}`.toLowerCase().includes(q) : false) ||
        `rt ${f.rt}`.toLowerCase().includes(q);
      return rtMatch && searchMatch;
    });
  }, [families, searchQuickLunas, isRW, myRT]);

  const handleQuickLunasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillQL) {
      showToast('Pilih jenis tagihan terlebih dahulu', 'error');
      return;
    }
    
    setIsProcessingQL(true);
    try {
      await payBillManually(selectedBillQL, activeUser.name);
      showToast('Pembayaran manual berhasil dicatat. Status: LUNAS!', 'success');
      setSelectedBillQL('');
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses pembayaran manual', 'error');
    } finally {
      setIsProcessingQL(false);
    }
  };

  const handleSetoranKlikLunas = async (familyBillId: string) => {
    setIsProcessingSetoranLunas(familyBillId);
    try {
      await payBillManually(familyBillId, activeUser.name);
      showToast('Setoran RT berhasil dikonfirmasi Lunas!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses pelunasan setoran', 'error');
    } finally {
      setIsProcessingSetoranLunas(null);
    }
  };

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

        .settings-outer-container {
          padding: 24px 32px;
        }
        .settings-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 32px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
        }
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .settings-inner-card {
          background: #f8fafc;
          padding: 24px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .table-responsive-premium {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .overview-grid-premium {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 40px;
        }
        .overview-left-pane {
          text-align: center;
          border-right: 1px solid #f1f5f9;
          padding-right: 40px;
        }
        .quick-lunas-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .quick-lunas-left-pane {
          border-right: 1px solid #f1f5f9;
          padding-right: 24px;
        }
        .qris-grid-premium {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 12px;
        }
        .card-header-filters-premium {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .pending-actions {
          display: flex;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .settings-outer-container {
            padding: 12px 0px;
          }
          .settings-card {
            padding: 20px 16px;
            border-radius: 20px;
          }
          .settings-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .settings-inner-card {
            padding: 16px;
          }
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
          .rt-setoran-item-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            padding: 16px !important;
          }
          .rt-admin-info-pane {
            border-right: none !important;
            border-bottom: 1px solid #f1f5f9;
            padding-right: 0 !important;
            padding-bottom: 16px;
          }
          .rt-bill-row {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 12px;
          }
          .rt-bill-row > div:last-child {
            width: 100%;
            justify-content: space-between;
            display: flex;
          }
          .overview-grid-premium {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .overview-left-pane {
            border-right: none !important;
            border-bottom: 1px solid #f1f5f9;
            padding-right: 0 !important;
            padding-bottom: 24px;
          }
          .quick-lunas-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .quick-lunas-left-pane {
            border-right: none !important;
            border-bottom: 1px solid #f1f5f9;
            padding-right: 0 !important;
            padding-bottom: 24px;
          }
          .qris-grid-premium {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .card-header-filters-premium {
            width: 100%;
            flex-direction: column;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .card-header-filters-premium .search-box {
            width: 100% !important;
          }
          .card-header-filters-premium .search-box input {
            width: 100% !important;
          }
          .card-header-filters-premium select {
            width: 100% !important;
          }
          .pending-card {
            flex-direction: column;
            align-items: stretch !important;
            gap: 16px;
          }
          .pending-card > div:first-child {
            align-items: flex-start !important;
          }
          .pending-actions {
            width: 100%;
          }
          .pending-actions button {
            flex: 1;
            justify-content: center;
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
          {!isRWOnly && (
            <button className="btn btn-secondary" onClick={() => setActiveTab('reports')}>
              <Download size={14} /> Ekspor Data
            </button>
          )}
          {isRW && !isRWOnly && (
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
            <div className="stat-lbl">{isRWOnly ? 'Kas Setoran RW' : `Saldo Kas (${isRW ? 'RW 011' : `RT ${myRT}`})`}</div>
          </div>
        </div>
        <div className="stat-card-premium green">
          <div className="icon-box"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-val">Rp {stats.approvedThisMonth.toLocaleString('id-ID')}</div>
            <div className="stat-lbl">{isRWOnly ? 'Setoran Bulan Ini' : 'Pemasukan Bulan Ini'}</div>
          </div>
        </div>
        <div className="stat-card-premium red">
          <div className="icon-box"><TrendingDown size={22} /></div>
          <div>
            <div className="stat-val">Rp {stats.totalTunggakan.toLocaleString('id-ID')}</div>
            <div className="stat-lbl">{isRWOnly ? 'Tunggakan Setoran' : 'Total Tunggakan Aktif'}</div>
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
          <BarChart2 size={14} style={{ display: 'inline', marginRight: 6 }} /> {isRWOnly ? 'Setoran RT ke RW' : 'Ikhtisar'}
        </button>
        {!isRWOnly && (
          <button className={`tab-btn ${activeTab === 'quick_lunas' ? 'active' : ''}`} onClick={() => {
            setActiveTab('quick_lunas');
            setSearchQuickLunas('');
            setSelectedFamilyQL(null);
            setSelectedBillQL('');
          }}>
            <Check size={14} style={{ display: 'inline', marginRight: 6 }} /> Quick Lunas (Tunai)
          </button>
        )}
        <button className={`tab-btn ${activeTab === 'bills' ? 'active' : ''}`} onClick={() => setActiveTab('bills')}>
          <CreditCard size={14} style={{ display: 'inline', marginRight: 6 }} /> Manajemen Tagihan
        </button>
        {!isRWOnly && (
          <button className={`tab-btn ${activeTab === 'warga_kk' ? 'active' : ''}`} onClick={() => setActiveTab('warga_kk')}>
            <User size={14} style={{ display: 'inline', marginRight: 6 }} /> Bulanan KK (Matrix 12 Bulan)
          </button>
        )}
        <button className={`tab-btn ${activeTab === 'verifikasi' ? 'active' : ''}`} onClick={() => setActiveTab('verifikasi')}>
          <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} /> Verifikasi Bukti
        </button>
        {!isRWOnly && (
          <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <FileText size={14} style={{ display: 'inline', marginRight: 6 }} /> Laporan & Ekspor
          </button>
        )}
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={14} style={{ display: 'inline', marginRight: 6 }} /> Pengaturan
        </button>
      </div>

      {/* TAB CONTENTS */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          isRWOnly ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
              <div className="card-header-premium">
                <div>
                  <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Setoran Kas RT ke RW</h3>
                  <p className="card-subtitle-premium">Daftar Ketua RT dan status penyerahan setoran kas bulanan ke RW 011</p>
                </div>
              </div>
              <div className="card-body-premium">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {rtSetoranOverview.map((rt) => {
                    const pendingCount = rt.bills.filter(b => b.status === 'MENUNGGU VERIFIKASI').length;
                    const unpaidCount = rt.bills.filter(b => b.status === 'BELUM BAYAR' || b.status === 'MENUNGGAK').length;
                    
                    return (
                      <div 
                        key={rt.rtId} 
                        style={{ 
                          border: '1px solid #f1f5f9', 
                          borderRadius: 20, 
                          padding: 24, 
                          background: '#fff',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.01)',
                          display: 'grid',
                          gridTemplateColumns: '300px 1fr',
                          gap: 24
                        }}
                        className="rt-setoran-item-grid"
                      >
                        {/* RT Admin Info */}
                        <div style={{ borderRight: '1px solid #f1f5f9', paddingRight: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} className="rt-admin-info-pane">
                          <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#eff6ff', color: '#2563eb', padding: '6px 14px', borderRadius: 12, fontWeight: 800, fontSize: 12, marginBottom: 12 }}>
                              RT {rt.rtId}
                            </div>
                            <h4 style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', margin: '0 0 6px 0' }}>{rt.adminName}</h4>
                            {rt.phoneNumber ? (
                              <a 
                                href={`https://wa.me/${rt.phoneNumber.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16a34a', fontWeight: 700, textDecoration: 'none', marginTop: 4 }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.035-4.475l.38.225c1.552.922 3.327 1.409 5.143 1.411 5.48.002 9.941-4.457 9.944-9.94.002-2.657-1.03-5.156-2.906-7.033A9.873 9.873 0 0 0 11.999 1.25C6.517 1.25 2.057 5.711 2.054 11.196c-.001 1.912.519 3.778 1.505 5.423l.254.425-1 3.65 3.744-.982zm10.962-6.84c-.272-.136-1.61-.795-1.86-.886-.25-.091-.432-.136-.613.136-.182.273-.704.886-.863 1.068-.159.182-.318.205-.59.069-.272-.136-1.15-.424-2.19-1.353-.809-.721-1.355-1.613-1.514-1.886-.159-.273-.017-.42.119-.556.123-.122.272-.318.409-.477.136-.159.182-.273.272-.455.091-.182.046-.341-.023-.477-.069-.136-.613-1.477-.84-2.023-.222-.534-.486-.46-.668-.469-.173-.008-.371-.01-.57-.01-.199 0-.523.075-.797.373-.272.295-1.04.1.018-1.04 2.227 0 .613 1.636 1.159 1.818 1.341.182.182 1.42 2.167 3.441 3.042.48.208.856.332 1.149.425.483.153.923.132 1.272.08.389-.058 1.61-.659 1.838-1.296.227-.636.227-1.182.159-1.296-.068-.113-.25-.204-.523-.34z" />
                                </svg>
                                WhatsApp Ketua RT
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No HP belum terdaftar</span>
                            )}
                          </div>
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              Ringkasan Tagihan Setoran:
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: unpaidCount > 0 ? '#ef4444' : '#10b981' }}>
                                {unpaidCount} Belum Lunas
                              </span>
                              {pendingCount > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                                  {pendingCount} Verifikasi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Setoran Bills List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {rt.bills.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12, fontStyle: 'italic', padding: '20px 0' }}>
                              Belum ada tagihan setoran untuk RT ini.
                            </div>
                          ) : (
                            rt.bills.map((bill) => {
                              const isUnpaid = bill.status === 'BELUM BAYAR' || bill.status === 'MENUNGGAK';
                              const isPending = bill.status === 'MENUNGGU VERIFIKASI';
                              const isLunas = bill.status === 'LUNAS';

                              return (
                                <div 
                                  key={bill.id} 
                                  style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    padding: '12px 18px', 
                                    background: '#f8fafc', 
                                    borderRadius: 14,
                                    border: '1px solid #e2e8f0'
                                  }}
                                  className="rt-bill-row"
                                >
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>{bill.title}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                      Jatuh Tempo: <b>{bill.dueDate}</b> &nbsp;·&nbsp; Nominal: <b>Rp {bill.amount.toLocaleString('id-ID')}</b>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Status Badge */}
                                    <span 
                                      className={`status-badge-premium ${isLunas ? 'active' : 'inactive'}`}
                                      style={{ 
                                        background: isLunas ? '#dcfce7' : isPending ? '#fff7ed' : '#fef2f2', 
                                        color: isLunas ? '#15803d' : isPending ? '#c2410c' : '#b91c1c'
                                      }}
                                    >
                                      {bill.status}
                                    </span>

                                    {/* Action Buttons */}
                                    {isUnpaid && (
                                      <button 
                                        onClick={() => handleSetoranKlikLunas(bill.id)}
                                        disabled={isProcessingSetoranLunas === bill.id}
                                        className="btn btn-primary btn-sm"
                                        style={{ background: '#10b981', border: 'none', height: 32, fontSize: 11, fontWeight: 800, borderRadius: 8, padding: '0 12px' }}
                                      >
                                        {isProcessingSetoranLunas === bill.id ? 'Memproses...' : 'Klik Lunas'}
                                      </button>
                                    )}

                                    {isPending && (
                                      <button 
                                        onClick={() => setActiveTab('verifikasi')}
                                        className="btn btn-secondary btn-sm"
                                        style={{ height: 32, fontSize: 11, fontWeight: 800, borderRadius: 8, padding: '0 12px', border: '1px solid #c2410c', color: '#c2410c' }}
                                      >
                                        <Eye size={12} style={{ display: 'inline', marginRight: 4 }} /> Struk
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {rtSetoranOverview.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                      <CheckCircle size={32} style={{ color: '#22c55e', margin: '0 auto 12px', display: 'block' }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Semua setoran RT lunas / tidak ada tagihan aktif!</div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
              <div className="card-header-premium">
                <div>
                  <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Ringkasan Partisipasi Iuran</h3>
                  <p className="card-subtitle-premium">Rasio pembayaran tagihan warga secara keseluruhan</p>
                </div>
              </div>
              <div className="card-body-premium">
                <div className="overview-grid-premium">
                  <div className="overview-left-pane">
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
          )
        )}

        {activeTab === 'bills' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Daftar Master Tagihan VSJ</h3>
                <p className="card-subtitle-premium">Kelola atau buat tagihan iuran khusus di wilayah RW 011</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                setNewBillData({
                  title: '',
                  category: 'Iuran Bulanan',
                  amount: '',
                  dueDate: '',
                  targetType: activeUser.adminRole === 'developer' ? 'all' : (isRW ? 'rt_admin' : 'rt'),
                  targetValue: 'all'
                });
                setShowCreateBillModal(true);
              }}>
                <Plus size={16} /> Buat Tagihan Baru
              </button>
            </div>
            <div className="card-body-premium table-responsive-premium" style={{ padding: 0 }}>
              <table className="matrix-table" style={{ textAlign: 'left', minWidth: 700 }}>
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
                  {filteredMasterBills.map(b => (
                    <tr key={b.id}>
                      <td style={{ paddingLeft: 32, fontWeight: 800 }}>{b.title}</td>
                      <td><span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{b.category}</span></td>
                      <td style={{ fontWeight: 800 }}>Rp {b.amount.toLocaleString('id-ID')}</td>
                      <td>{b.dueDate}</td>
                      <td style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700 }}>
                        {b.targetType === 'all' ? 'Semua Warga' 
                          : b.targetType === 'rt' 
                          ? (b.targetValue === 'all' || b.targetValue === 'all_rt' ? 'Semua RT' : `RT ${b.targetValue}`)
                          : b.targetType === 'rt_admin'
                          ? (b.targetValue === 'all' || b.targetValue === 'all_rt' ? 'Semua Ketua RT' : `Ketua RT ${b.targetValue}`)
                          : `No. KK ${b.targetValue}`}
                      </td>
                      <td>{b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString('id-ID') : 'Baru saja'}</td>
                    </tr>
                  ))}
                  {filteredMasterBills.length === 0 && (
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
              <div className="card-header-filters-premium">
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
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>
                  {isRWOnly ? 'Verifikasi Bukti Setoran RT' : 'Verifikasi Bukti Transfer Warga'}
                </h3>
                <p className="card-subtitle-premium">
                  {isRWOnly 
                    ? 'Tinjau bukti transfer setoran kas dari Ketua RT dan konfirmasi saldo masuk' 
                    : 'Tinjau struk pembayaran digital warga dan konfirmasi kas masuk'}
                </p>
              </div>
            </div>
            <div className="card-body-premium">
              {pendingPaymentsForVerif.map((p) => {
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
                        <div style={{ fontWeight: 800, fontSize: 14 }}>
                          {isRWOnly ? `Ketua RT ${p.rt} (${p.kepalaKeluarga})` : p.kepalaKeluarga}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>KK:</span>
                          <SensitiveDataViewer value={p.nomorKK} type="No. KK" residentId={p.familyId || p.id} residentName={p.kepalaKeluarga} adminUser={user} />
                          <span>&nbsp;·&nbsp; RT {p.rt} / 011</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                          Tagihan: {bill?.title || 'Iuran Bulanan'} (Rp {p.amount.toLocaleString('id-ID')})
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          Dikirim: {p.paymentDate?.toDate ? p.paymentDate.toDate().toLocaleString('id-ID') : 'Baru saja'} via {p.paymentMethod}
                        </div>
                      </div>
                    </div>

                    <div className="pending-actions">
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
              {pendingPaymentsForVerif.length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                  <CheckCircle size={32} style={{ color: '#22c55e', margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {isRWOnly ? 'Semua setoran RT terverifikasi!' : 'Semua pembayaran bersih terverifikasi!'}
                  </div>
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
            <div className="card-body-premium table-responsive-premium" style={{ padding: 0 }}>
              <table className="matrix-table" style={{ textAlign: 'left', minWidth: 800 }}>
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
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}><SensitiveDataViewer value={f.nomorKK} type="No. KK" residentId={f.id} residentName={f.kepalaKeluarga} adminUser={user} /></td>
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

        {activeTab === 'quick_lunas' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-premium">
            <div className="card-header-premium">
              <div>
                <h3 className="card-title-premium" style={{ fontSize: 16, fontWeight: 900 }}>Quick Lunas (Bayar Manual/Tunai)</h3>
                <p className="card-subtitle-premium">Catat pembayaran iuran tunai warga secara instan tanpa struk transfer</p>
              </div>
            </div>
            <div className="card-body-premium">
              <div className="quick-lunas-grid">
                {/* Search Panel */}
                <div className="quick-lunas-left-pane">
                  <div className="form-group-premium" style={{ marginBottom: 16 }}>
                    <label>Cari Kepala Keluarga, Alamat, atau No. KK</label>
                    <div style={{ position: 'relative', marginTop: 4 }}>
                      <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input 
                        placeholder="Ketik nama, alamat, no KK..." 
                        value={searchQuickLunas} onChange={e => {
                          setSearchQuickLunas(e.target.value);
                          setSelectedFamilyQL(null);
                          setSelectedBillQL('');
                        }}
                        style={{ width: '100%', border: '1px solid #cbd5e1', height: 42, borderRadius: 10, paddingLeft: 36, fontSize: 13, outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                    {quickLunasFamilies.map(fam => (
                      <div 
                        key={fam.id} 
                        onClick={() => {
                          setSelectedFamilyQL(fam);
                          setSelectedBillQL('');
                        }}
                        style={{
                          padding: 12,
                          background: selectedFamilyQL?.id === fam.id ? '#eff6ff' : '#fff',
                          border: `1px solid ${selectedFamilyQL?.id === fam.id ? '#2563eb' : '#e2e8f0'}`,
                          borderRadius: 12,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#334155' }}>{fam.kepalaKeluarga}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>KK:</span>
                          <SensitiveDataViewer value={fam.nomorKK} type="No. KK" residentId={fam.id} residentName={fam.kepalaKeluarga} adminUser={user} />
                          <span>&nbsp;·&nbsp; RT {fam.rt}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{fam.blok ? `Blok ${fam.blok} No. ${fam.nomorRumah}` : fam.alamat}</div>
                      </div>
                    ))}
                    {searchQuickLunas.trim() && quickLunasFamilies.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>Tidak ada keluarga ditemukan.</div>
                    )}
                    {!searchQuickLunas.trim() && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>Masukkan kata kunci untuk mencari warga...</div>
                    )}
                  </div>
                </div>

                {/* Form Lunas Panel */}
                <div>
                  {selectedFamilyQL ? (
                    <form onSubmit={handleQuickLunasSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Keluarga Terpilih</div>
                        <strong style={{ fontSize: 15, color: '#1e3a8a', display: 'block', marginTop: 4 }}>{selectedFamilyQL.kepalaKeluarga}</strong>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <span>No. KK:</span>
                          <SensitiveDataViewer value={selectedFamilyQL.nomorKK} type="No. KK" residentId={selectedFamilyQL.id} residentName={selectedFamilyQL.kepalaKeluarga} adminUser={user} />
                          <span>&nbsp;·&nbsp; RT {selectedFamilyQL.rt}/011</span>
                        </div>
                      </div>

                      <div className="form-group-premium">
                        <label>Pilih Jenis Tagihan Aktif</label>
                        <select 
                          className="form-input-premium" 
                          value={selectedBillQL} 
                          onChange={e => setSelectedBillQL(e.target.value)}
                          required
                          style={{ marginTop: 4 }}
                        >
                          <option value="">-- Pilih Tagihan Belum Lunas --</option>
                          {familyBills
                            .filter(fb => fb.nomorKK === selectedFamilyQL.nomorKK && fb.status !== 'LUNAS')
                            .map(fb => (
                              <option key={fb.id} value={fb.id}>
                                {fb.title} (Rp {fb.amount.toLocaleString('id-ID')})
                              </option>
                            ))
                          }
                        </select>
                        {familyBills.filter(fb => fb.nomorKK === selectedFamilyQL.nomorKK && fb.status !== 'LUNAS').length === 0 && (
                          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 6 }}>
                            ✓ Semua tagihan untuk keluarga ini sudah LUNAS.
                          </div>
                        )}
                      </div>

                      <button 
                        type="submit" 
                        disabled={isProcessingQL || !selectedBillQL}
                        className="btn btn-primary" 
                        style={{ width: '100%', height: 46, borderRadius: 12, fontWeight: 800, marginTop: 10, background: '#10b981' }}
                      >
                        {isProcessingQL ? 'Memproses...' : 'Konfirmasi LUNAS (Lunas Tunai)'}
                      </button>
                    </form>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: 24, textAlign: 'center' }}>
                      <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih Warga di Panel Kiri</div>
                      <p style={{ fontSize: 11, marginTop: 4 }}>Silakan cari dan klik salah satu keluarga terlebih dahulu untuk melihat daftar tagihan aktif.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* If RT Admin, show billing settings (nominal/due day) */}
            {!isRW && (
              <IuranBulananSettings rtId={myRT} showToast={showToast} />
            )}
            
            {/* Payment custom methods manager */}
            <PaymentSettingsManager rtIdOrRw={isRW ? 'rw' : myRT} showToast={showToast} />
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
                          <option value="Iuran Bulanan">Iuran Bulanan Warga</option>
                          <option value="Setoran Kas RT ke RW">Setoran Kas RT ke RW</option>
                          <option value="Iuran Keamanan">Iuran Keamanan</option>
                          <option value="Iuran Kebersihan">Iuran Kebersihan</option>
                          <option value="Iuran Kegiatan">Iuran Kegiatan / Spesial</option>
                          <option value="Donasi / Amal">Sumbangan / Donasi</option>
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
                          value={newBillData.targetType} 
                          onChange={e => {
                            const val = e.target.value as any;
                            setNewBillData({
                              ...newBillData, 
                              targetType: val, 
                              targetValue: 'all', 
                              category: val === 'rt_admin' ? 'Setoran Kas RT ke RW' : newBillData.category
                            });
                          }}
                        >
                          {activeUser.adminRole === 'developer' ? (
                            <>
                              <option value="all">Semua Warga RW 011</option>
                              <option value="rt_admin">Tagihan ke Akun Ketua RT (Setoran Kas RW)</option>
                              <option value="rt">Iuran Warga RT</option>
                              <option value="kk">Keluarga Spesifik (Berdasarkan KK)</option>
                            </>
                          ) : isRW ? (
                            <>
                              <option value="rt_admin">Tagihan ke Akun Ketua RT (Setoran Kas RW)</option>
                            </>
                          ) : (
                            <>
                              <option value="rt">Iuran Warga RT Saya ({myRT})</option>
                              <option value="kk">Keluarga Spesifik (Berdasarkan KK)</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {isRW && (newBillData.targetType === 'rt' || newBillData.targetType === 'rt_admin') && (
                      <div className="form-group-premium">
                        <label>Pilih RT Sasaran</label>
                        <select 
                          className="form-input-premium"
                          value={newBillData.targetValue} 
                          onChange={e => setNewBillData({...newBillData, targetValue: e.target.value})}
                        >
                          <option value="all">Semua RT (RT 001 - RT 005)</option>
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
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>No. KK:</span>
                  <SensitiveDataViewer value={selectedFamilyDetail.nomorKK} type="No. KK" residentId={selectedFamilyDetail.id} residentName={selectedFamilyDetail.kepalaKeluarga} adminUser={user} />
                  <span>• RT {selectedFamilyDetail.rt} / 011</span>
                </div>
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

function IuranBulananSettings({ rtId, showToast }: { rtId: string; showToast: (msg: string, type: 'success' | 'error') => void }) {
  const [settings, setSettings] = useState<{
    nominal: number;
    dueDay: number;
    nominalChangesThisMonth: number;
    dueDayChangesThisMonth: number;
    lastNominalChangeDate?: any;
    lastDueDayChangeDate?: any;
  } | null>(null);

  const [inputNominal, setInputNominal] = useState('');
  const [inputDueDay, setInputDueDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingNominal, setUpdatingNominal] = useState(false);
  const [updatingDueDay, setUpdatingDueDay] = useState(false);

  useEffect(() => {
    const docRef = doc(db, 'rt_settings', rtId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setSettings({
          nominal: data.nominal ?? 50000,
          dueDay: data.dueDay ?? 10,
          nominalChangesThisMonth: data.nominalChangesThisMonth ?? 0,
          dueDayChangesThisMonth: data.dueDayChangesThisMonth ?? 0,
          lastNominalChangeDate: data.lastNominalChangeDate,
          lastDueDayChangeDate: data.lastDueDayChangeDate,
        });
      } else {
        setDoc(docRef, {
          nominal: 50000,
          dueDay: 10,
          nominalChangesThisMonth: 0,
          dueDayChangesThisMonth: 0,
          lastNominalChangeDate: null,
          lastDueDayChangeDate: null,
        }).catch(console.error);
        
        setSettings({
          nominal: 50000,
          dueDay: 10,
          nominalChangesThisMonth: 0,
          dueDayChangesThisMonth: 0,
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [rtId]);

  const handleUpdateNominal = async () => {
    const val = parseInt(inputNominal);
    if (isNaN(val) || val <= 0) {
      showToast('Nominal harus berupa angka positif', 'error');
      return;
    }

    setUpdatingNominal(true);
    try {
      const docRef = doc(db, 'rt_settings', rtId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data() || {};
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      let count = data.nominalChangesThisMonth || 0;
      let lastChange = data.lastNominalChangeDate?.toDate ? data.lastNominalChangeDate.toDate() : null;

      if (lastChange) {
        if (lastChange.getFullYear() !== currentYear || lastChange.getMonth() !== currentMonth) {
          count = 0;
        }
      }

      if (count >= 3) {
        showToast('Gagal: Batas pengubahan nominal iuran (maksimal 3 kali sebulan) telah tercapai!', 'error');
        setUpdatingNominal(false);
        return;
      }

      await setDoc(docRef, {
        ...data,
        nominal: val,
        nominalChangesThisMonth: count + 1,
        lastNominalChangeDate: Timestamp.now()
      }, { merge: true });

      showToast(`Nominal iuran bulanan berhasil diubah menjadi Rp ${val.toLocaleString('id-ID')}`, 'success');
      setInputNominal('');
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui nominal iuran', 'error');
    } finally {
      setUpdatingNominal(false);
    }
  };

  const handleUpdateDueDay = async () => {
    const val = parseInt(inputDueDay);
    if (isNaN(val) || val < 1 || val > 28) {
      showToast('Tanggal jatuh tempo harus di antara 1 sampai 28', 'error');
      return;
    }

    setUpdatingDueDay(true);
    try {
      const docRef = doc(db, 'rt_settings', rtId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data() || {};
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      let count = data.dueDayChangesThisMonth || 0;
      let lastChange = data.lastDueDayChangeDate?.toDate ? data.lastDueDayChangeDate.toDate() : null;

      if (lastChange) {
        if (lastChange.getFullYear() !== currentYear || lastChange.getMonth() !== currentMonth) {
          count = 0;
        }
      }

      if (count >= 2) {
        showToast('Gagal: Batas pengubahan tanggal jatuh tempo (maksimal 2 kali sebulan) telah tercapai!', 'error');
        setUpdatingDueDay(false);
        return;
      }

      await setDoc(docRef, {
        ...data,
        dueDay: val,
        dueDayChangesThisMonth: count + 1,
        lastDueDayChangeDate: Timestamp.now()
      }, { merge: true });

      showToast(`Tanggal jatuh tempo berhasil diubah menjadi tanggal ${val} setiap bulan`, 'success');
      setInputDueDay('');
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui tanggal jatuh tempo', 'error');
    } finally {
      setUpdatingDueDay(false);
    }
  };

  if (loading || !settings) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Memuat konfigurasi...</div>;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const getNominalChangesLeft = () => {
    const lastChange = settings.lastNominalChangeDate?.toDate ? settings.lastNominalChangeDate.toDate() : null;
    if (lastChange && (lastChange.getFullYear() !== currentYear || lastChange.getMonth() !== currentMonth)) {
      return 3;
    }
    return Math.max(0, 3 - settings.nominalChangesThisMonth);
  };

  const getDueDayChangesLeft = () => {
    const lastChange = settings.lastDueDayChangeDate?.toDate ? settings.lastDueDayChangeDate.toDate() : null;
    if (lastChange && (lastChange.getFullYear() !== currentYear || lastChange.getMonth() !== currentMonth)) {
      return 2;
    }
    return Math.max(0, 2 - settings.dueDayChangesThisMonth);
  };

  const nominalChangesLeft = getNominalChangesLeft();
  const dueDayChangesLeft = getDueDayChangesLeft();

  return (
    <div className="settings-outer-container">
      <div className="settings-card">
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          Pengaturan Iuran Bulanan RT {rtId}
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Atur nominal dan tanggal jatuh tempo tagihan kas rutin warga. Sistem akan menagih warga secara otomatis setiap bulan berdasarkan nominal ini.
        </p>

        <div className="settings-grid">
          {/* Card Nominal */}
          <div className="settings-inner-card">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Nominal Iuran Aktif
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', marginBottom: 12 }}>
              Rp {settings.nominal.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span>Sisa ubah bulan ini:</span>
              <strong style={{ color: nominalChangesLeft === 0 ? '#ef4444' : '#10b981' }}>{nominalChangesLeft} kali lagi</strong>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="number" 
                className="form-input-premium" 
                placeholder="Nominal baru (Rp)" 
                value={inputNominal}
                onChange={e => setInputNominal(e.target.value)}
                style={{ flex: 1, margin: 0 }}
                disabled={nominalChangesLeft === 0}
              />
              <button 
                onClick={handleUpdateNominal}
                className="btn btn-primary"
                style={{ height: 42, padding: '0 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={updatingNominal || nominalChangesLeft === 0}
              >
                Ubah
              </button>
            </div>
          </div>

          {/* Card Jatuh Tempo */}
          <div className="settings-inner-card">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Tanggal Jatuh Tempo Aktif
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', marginBottom: 12 }}>
              Tanggal {settings.dueDay} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>setiap bulan</span>
            </div>
            <div style={{ fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span>Sisa ubah bulan ini:</span>
              <strong style={{ color: dueDayChangesLeft === 0 ? '#ef4444' : '#10b981' }}>{dueDayChangesLeft} kali lagi</strong>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="number" 
                min="1" max="28"
                className="form-input-premium" 
                placeholder="Hari (1-28)" 
                value={inputDueDay}
                onChange={e => setInputDueDay(e.target.value)}
                style={{ flex: 1, margin: 0 }}
                disabled={dueDayChangesLeft === 0}
              />
              <button 
                onClick={handleUpdateDueDay}
                className="btn btn-primary"
                style={{ height: 42, padding: '0 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={updatingDueDay || dueDayChangesLeft === 0}
              >
                Ubah
              </button>
            </div>
          </div>
        </div>

        {(nominalChangesLeft === 0 || dueDayChangesLeft === 0) && (
          <div style={{
            background: '#fffeb2',
            color: '#713f12',
            padding: '12px 16px',
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.5,
            border: '1px solid #fef08a'
          }}>
            ℹ️ <strong>Batas Pengubahan</strong>: Anda telah mencapai batas maksimal perubahan untuk bulan berjalan. Batas kuota akan di-reset otomatis pada awal bulan berikutnya.
          </div>
        )}
      </div>
    </div>
  );
}

interface PaymentSettingsManagerProps {
  rtIdOrRw: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

function PaymentSettingsManager({ rtIdOrRw, showToast }: PaymentSettingsManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankActive, setBankActive] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  const [ewalletActive, setEwalletActive] = useState(false);
  const [ewalletProvider, setEwalletProvider] = useState('');
  const [ewalletPhoneNumber, setEwalletPhoneNumber] = useState('');
  const [ewalletAccountName, setEwalletAccountName] = useState('');

  const [qrisActive, setQrisActive] = useState(false);
  const [qrisName, setQrisName] = useState('');
  const [qrisImage, setQrisImage] = useState('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const settings = await getPaymentSettings(rtIdOrRw);
        if (settings) {
          setBankActive(settings.bank?.active ?? false);
          setBankName(settings.bank?.bankName ?? '');
          setBankAccountNumber(settings.bank?.accountNumber ?? '');
          setBankAccountName(settings.bank?.accountName ?? '');

          setEwalletActive(settings.ewallet?.active ?? false);
          setEwalletProvider(settings.ewallet?.provider ?? '');
          setEwalletPhoneNumber(settings.ewallet?.phoneNumber ?? '');
          setEwalletAccountName(settings.ewallet?.accountName ?? '');

          setQrisActive(settings.qris?.active ?? false);
          setQrisName(settings.qris?.qrisName ?? '');
          setQrisImage(settings.qris?.qrisImage ?? '');
        } else {
          setBankActive(false);
          setBankName('');
          setBankAccountNumber('');
          setBankAccountName('');
          setEwalletActive(false);
          setEwalletProvider('');
          setEwalletPhoneNumber('');
          setEwalletAccountName('');
          setQrisActive(false);
          setQrisName('');
          setQrisImage('');
        }
      } catch (err) {
        console.error("Error loading payment settings:", err);
        showToast("Gagal memuat pengaturan metode pembayaran", "error");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [rtIdOrRw]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const settingsObj = {
        bank: {
          active: bankActive,
          bankName,
          accountNumber: bankAccountNumber,
          accountName: bankAccountName
        },
        ewallet: {
          active: ewalletActive,
          provider: ewalletProvider,
          phoneNumber: ewalletPhoneNumber,
          accountName: ewalletAccountName
        },
        qris: {
          active: qrisActive,
          qrisName,
          qrisImage
        }
      };
      await savePaymentSettings(rtIdOrRw, settingsObj);
      showToast("Pengaturan metode pembayaran berhasil disimpan", "success");
    } catch (err) {
      console.error("Error saving payment settings:", err);
      showToast("Gagal menyimpan pengaturan metode pembayaran", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQRImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Ukuran gambar QRIS melebihi 2MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrisImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="settings-outer-container" style={{ paddingTop: 0 }}>
        <div className="settings-card" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: '#64748b' }}>
          Memuat pengaturan metode pembayaran...
        </div>
      </div>
    );
  }

  return (
    <div className="settings-outer-container" style={{ paddingTop: 0 }}>
      <form onSubmit={handleSave} className="settings-card">
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          Metode Pembayaran Mandiri ({rtIdOrRw === 'rw' ? 'RW 011' : `RT ${rtIdOrRw}`})
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Konfigurasikan rekening bank, akun e-wallet, atau QRIS yang dapat dipilih warga saat membayar tagihan.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* BANK ACCORDION/CARD */}
          <div style={{ background: '#f8fafc', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>Transfer Bank</h3>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Terima iuran lewat transfer rekening bank</span>
                </div>
              </div>
              <label className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: bankActive ? '#2563eb' : '#64748b' }}>
                  {bankActive ? 'Aktif' : 'Nonaktif'}
                </span>
                <input 
                  type="checkbox" 
                  checked={bankActive} 
                  onChange={e => setBankActive(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </label>
            </div>

            {bankActive && (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="form-group-premium">
                  <label>Nama Bank</label>
                  <input 
                    type="text" 
                    className="form-input-premium" 
                    placeholder="Contoh: Bank Mandiri, BCA, BRI"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group-premium">
                  <label>Nomor Rekening</label>
                  <input 
                    type="text" 
                    className="form-input-premium" 
                    placeholder="Contoh: 131001234567"
                    value={bankAccountNumber}
                    onChange={e => setBankAccountNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group-premium">
                  <label>Nama Pemilik Rekening</label>
                  <input 
                    type="text" 
                    className="form-input-premium" 
                    placeholder="Contoh: Bendahara RT 001"
                    value={bankAccountName}
                    onChange={e => setBankAccountName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* E-WALLET ACCORDION/CARD */}
          <div style={{ background: '#f8fafc', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>E-wallet</h3>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Terima iuran lewat dompet digital (Gopay, OVO, DANA, dll)</span>
                </div>
              </div>
              <label className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ewalletActive ? '#16a34a' : '#64748b' }}>
                  {ewalletActive ? 'Aktif' : 'Nonaktif'}
                </span>
                <input 
                  type="checkbox" 
                  checked={ewalletActive} 
                  onChange={e => setEwalletActive(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </label>
            </div>

            {ewalletActive && (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="form-group-premium">
                  <label>Penyedia E-wallet</label>
                  <input 
                    type="text" 
                    className="form-input-premium" 
                    placeholder="Contoh: Gopay, OVO, DANA, LinkAja"
                    value={ewalletProvider}
                    onChange={e => setEwalletProvider(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group-premium">
                  <label>Nomor HP / ID E-wallet</label>
                  <input 
                    type="text" 
                    className="form-input-premium" 
                    placeholder="Contoh: 081234567890"
                    value={ewalletPhoneNumber}
                    onChange={e => setEwalletPhoneNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group-premium">
                  <label>Nama Pemilik Akun</label>
                  <input 
                    type="text" 
                    className="form-input-premium" 
                    placeholder="Contoh: Kas RT 001"
                    value={ewalletAccountName}
                    onChange={e => setEwalletAccountName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* QRIS ACCORDION/CARD */}
          <div style={{ background: '#f8fafc', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>QRIS Kode</h3>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Terima iuran lewat scan barcode QRIS serbaguna</span>
                </div>
              </div>
              <label className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: qrisActive ? '#d97706' : '#64748b' }}>
                  {qrisActive ? 'Aktif' : 'Nonaktif'}
                </span>
                <input 
                  type="checkbox" 
                  checked={qrisActive} 
                  onChange={e => setQrisActive(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </label>
            </div>

            {qrisActive && (
              <div className="qris-grid-premium">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group-premium">
                    <label>Nama / Merchant QRIS</label>
                    <input 
                      type="text" 
                      className="form-input-premium" 
                      placeholder="Contoh: QRIS RW 011 VSJ"
                      value={qrisName}
                      onChange={e => setQrisName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group-premium">
                    <label>Unggah Gambar Kode QRIS (Max 2MB)</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleQRImageChange}
                      style={{ fontSize: 12, marginTop: 4 }}
                      required={!qrisImage}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: 16, padding: 12, background: '#fff' }}>
                  {qrisImage ? (
                    <>
                      <img src={qrisImage} alt="QRIS Preview" style={{ width: 140, height: 140, objectFit: 'contain' }} />
                      <button 
                        type="button" 
                        onClick={() => setQrisImage('')}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 8, cursor: 'pointer' }}
                      >
                        Hapus Gambar
                      </button>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                      Belum ada gambar QRIS terunggah
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={saving}
          className="btn btn-primary"
          style={{ width: '100%', height: 48, borderRadius: 14, fontWeight: 800, marginTop: 24, fontSize: 14 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan Pembayaran'}
        </button>
      </form>
    </div>
  );
}
