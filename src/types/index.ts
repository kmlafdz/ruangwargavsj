export type AdminRole = 'developer' | 'rw' | 'rt';
export type AccountType = 'admin' | 'resident';
export type RegistrationStatus = 'Pending' | 'Approved' | 'Rejected';
export type AccountStatus = 'pending_registration' | 'waiting_family_approval' | 'waiting_admin_approval' | 'active' | 'rejected' | 'blocked';

export interface User {
  id: string;
  name: string;
  username?: string;
  chatUsername?: string;
  nik?: string;
  accountType: AccountType;
  adminRole?: AdminRole;
  communityPosition?: string; // e.g. "Ketua RW", "Sekretaris"
  rt_id?: string; // e.g. "001"
  rw_id?: string; // e.g. "011"
  email?: string;
  emailVerified?: boolean;
  phone?: string;
  status?: RegistrationStatus;
  registrationStatus?: 'pending_input' | 'pending_approval' | 'verified';
  accountStatus?: AccountStatus;
  isFirstLogin?: boolean;
  temporaryPasswordActive?: boolean;
  ktpPhotoUrl?: string;
  kkPhotoUrl?: string;
  facePhotoUrl?: string;
  familyId?: string;
  isKepalaKeluarga?: boolean;
  rejectionReason?: string;
  photoUrl?: string;
  password?: string;
  biometricEnabled?: boolean;
  biometricCredentialId?: string | null;
  dob?: string;
  createdAt?: any;
  extractedData?: {
    nik: string;
    fullName: string;
    address: string;
    placeOfBirth: string;
    dateOfBirth: string;
    gender: string;
  };
  pinSet?: boolean;
  pin?: string;
  noKK?: string;
  hubunganKeluarga?: string;
}



export interface Resident {
  id: string;
  nik: string;
  fullName: string;
  namaLengkap?: string; // Compatibility alias
  birthDate: string;
  address: string;
  rt: string;
  rw: string;
  phone: string;
  email?: string;
  familyId: string;
  isKepalaKeluarga: boolean;
  status: 'Tetap' | 'Kontrak';
  hasAccount: boolean;
  hubungan?: string; // Relationship to head
  statusKeluarga?: string; // Alias for hubungan
  jenisKelamin?: string;
  pekerjaan?: string;
  tanggalLahir?: string; // Alias for birthDate
  noTelepon?: string; // Alias for phone
}


export type FamilyMember = Resident;

export interface Family {
  id: string;
  nomorKK: string;
  kkNumber?: string; // Alias
  kepalaKeluarga: string;
  kepalaKeluargaId: string;
  alamat: string;
  address?: string; // Alias
  rt: string;
  rw: string;
  jumlahAnggota: number;
  status?: string;
  membersCount?: number;
}


export interface SuratRequest {
  id: string;
  residentId: string;
  residentName: string;
  type: string;
  date: string;
  status: 'Pending' | 'Disetujui' | 'Ditolak';
  notes?: string;
  fileUrl?: string;
}

export interface FinanceRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Masuk' | 'Keluar';
  category: string;
}

export interface Pengaduan {
  id: string;
  residentId: string;
  residentName: string;
  title: string;
  content: string;
  date: string;
  status: 'Baru' | 'Proses' | 'Selesai';
  reply?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  category: 'Informasi' | 'Kegiatan' | 'Urgent';
}

export interface RTData {
  name: string;
  count: number;
  residents: number;
}

