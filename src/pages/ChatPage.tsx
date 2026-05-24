import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, Loader2, MessageSquare, ShieldCheck, Star, ChevronLeft, Image, FileText, X, Download, File, Paperclip } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { showAlert } from '../utils/alert';
import { 
  collection, query, orderBy, limit, 
  onSnapshot, addDoc, serverTimestamp, where, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { CommunityPosition } from '../components/SocialBadge';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderFullName?: string;
  senderUsername?: string;
  senderPhoto?: string;
  senderPosition?: CommunityPosition;
  isKepalaKeluarga?: boolean;
  text: string;
  createdAt: any;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'document';
  attachmentSize?: string;
  replyToId?: string;
  replyToSenderName?: string;
  replyToText?: string;
  isEdited?: boolean;
}

const HARSH_WORDS = [
  // Indonesian vulgarities, variations and potential slurs (lowercase)
  'anjing', 'anjg', 'anj', 'ajg', 'anying', 'anyink', 'bangsat', 'bngst', 'bgsd', 'bajingan', 'bjg',
  'goblok', 'gblk', 'goblog', 'tolol', 'tll', 'idiot', 'idi0t', 'id!ot', 'bego', 'bg0', 'kampret',
  'kmprt', 'sialan', 'tai', 't4i', 'babi', 'b4bi', 'setan', 's3tan', 'brengsek', 'brngsk', 'mampus',
  'sinting', 'pecundang', 'bocah kontol', 'kontol', 'kntl', 'kont*l', 'k0nt0l', 'memek', 'mmk', 'm3m3k',
  'meki', 'ngentot', 'ngntt', 'entot', 'ngetot', 'jancok', 'jncok', 'j4nc0k', 'cuk', 'cok', 'asu',
  'a$u', 'monyet', 'mony3t', 'laknat', 'harampadah', 'harampjadah', 'harampjadah', 'harampadat',
  'pelacur', 'lonte', 'l0nte', 'sundal', 'bangke', 'bngke', 'taikucing', 'taibabi', 'otakudang',
  'mukatembok', 'manusiasampah', 'bjir', 'njir', 'anjir', 'asw', 'jingan', 'bangkelu', 'gobloklu',
  'bejad', 'bajirut', 'kampang', 'kunyuk', 'bacot', 'nyet', 'kntol', 'pantek', 'kimak', 'cibai',
  'peler', 'pantat', 'peju', 'coli', 'tetek', 'toket', 'ngewe', 'perek', 'jablay', 'binal',
  'b4ngs4t', 'k*ntl', 'm*m*k', 'ng*nt*t', 'b*ngs*t', 'bocil', 'incel',

  // English vulgarities, variations and potential slurs (lowercase)
  'fuck', 'fck', 'fk', 'f*ck', 'f**k', 'phuck', 'fuq', 'fucking', 'fcking', 'fuccing', 'fukin',
  'shit', 'sht', 'sh1t', 'sh!t', 'bullshit', 'bullsh*t', 'bs', 'bitch', 'btch', 'b1tch', 'biatch',
  'bastard', 'bstard', 'asshole', 'a-hole', 'assh0le', 'dick', 'dck', 'd1ck', 'pussy', 'pssy',
  'pu$$y', 'cunt', 'cnt', 'c*nt', 'motherfucker', 'mf', 'mfer', 'mthrfkr', 'sonofabitch', 'sob',
  'damn', 'dmn', 'hell', 'h3ll', 'slut', 'sl*t', 'whore', 'wh0re', 'retard', 'rtard', 'r-word',
  'loser', 'l00ser', 'moron', 'mrn', 'stupid', 'stup1d', 'jerk', 'jrk', 'douchebag', 'douche',
  'crap', 'cr4p', 'pissoff', 'p!ssoff', 'wanker', 'wnk', 'twat', 'tw@t', 'prick', 'pr1ck',
  'scumbag', 'scum', 'dipshit', 'dipsh*t', 'jackass', 'jacka$$', 'dumbass', 'dumb@ss',
  'pieceofshit', 'pos', 'freak', 'fr34k', 'nutjob', 'stfu', 'gtfo', 'kys', 'lmfao', 'wtf',
  'omfg', 'tf', 'af', 'idgaf', 'dgaf', 'smhdumbass', 'dumbmf', 'ffs', 'istg', 'ahole',
  'fuckingidiot', 'dumbasskid', 'trashplayer', 'uselessnoob', 'braindeadmoron', 'bitchassloser',
  'stupidmf', 'crymorebitch', 'shutthefuckup', 'yousuck', 'trashteam', 'toxicasshole',
  'dumbfuckingkid', 'nolep', 'betamale', 'simp', 'clown', 'npc', 'cringe', 'yapping',
  'fatherless', 'touchgrass', 'fvck', 'f4ck', 'f***', 'sh**', 'b*tch', 'a**hole'
];

const containsHarshWords = (text: string, customWords: string[] = []): { found: boolean; word: string } => {
  // 1. Check with punctuation and spaces intact (normal word checks)
  const normalizedWithSpaces = text.toLowerCase();
  
  // 2. Check compressed string without spaces or symbols (for bypassed combinations like 'taikucing' or 'cry more bitch')
  const compressed = normalizedWithSpaces.replace(/[^a-z0-9]/g, '');
  
  const combinedList = [...HARSH_WORDS, ...customWords];
  
  for (const word of combinedList) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    
    // If checking a wildcard/censored word or one with symbols
    if (word.includes('*') || word.includes('@') || word.includes('!') || word.includes('$')) {
      const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (regex.test(normalizedWithSpaces)) {
        return { found: true, word };
      }
      continue;
    }

    // Exact word boundary matching for short words, or loose check for long phrases
    if (word.length <= 4) {
      const regexBound = new RegExp(`\\b${word}\\b`, 'i');
      if (regexBound.test(normalizedWithSpaces)) {
        return { found: true, word };
      }
    } else {
      // Loose search in normal text
      if (normalizedWithSpaces.includes(word)) {
        return { found: true, word };
      }
      // Tight search in compressed text (for 'tai kucing' -> 'taikucing')
      if (cleanWord.length > 3 && compressed.includes(cleanWord)) {
        return { found: true, word };
      }
    }
  }
  return { found: false, word: '' };
};

const formatMessageText = (text: string) => {
  if (!text) return '';
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ fontWeight: 900 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export default function ChatPage({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitial = useRef(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    if (Capacitor.isNativePlatform()) {
      showListener = Keyboard.addListener('keyboardDidShow', () => {
        setIsKeyboardOpen(true);
      });
      hideListener = Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardOpen(false);
      });
    } else {
      const handleResize = () => {
        if (window.visualViewport) {
          const isKeyboard = window.innerHeight - window.visualViewport.height > 150;
          setIsKeyboardOpen(isKeyboard);
        }
      };
      window.visualViewport?.addEventListener('resize', handleResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    }

    return () => {
      if (showListener) {
        showListener.then((l: any) => l.remove());
      }
      if (hideListener) {
        hideListener.then((l: any) => l.remove());
      }
    };
  }, []);

  const [customHarshWords, setCustomHarshWords] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'harsh_words'), (docSnap) => {
      if (docSnap.exists()) {
        setCustomHarshWords(docSnap.data().words || []);
      }
    }, (err) => {
      console.error("Gagal sinkronisasi kata kasar:", err);
    });
    return () => unsub();
  }, []);
  const [selectedUser, setSelectedUser] = useState<{
    name: string;
    username: string;
    photoUrl?: string;
    position?: string;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'document';
    size: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const [residents, setResidents] = useState<User[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [tagStartIndex, setTagStartIndex] = useState(-1);

  const [actionMenuMessage, setActionMenuMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (msg: Message) => {
    longPressTimerRef.current = setTimeout(() => {
      setActionMenuMessage(msg);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleDeleteMessage = async () => {
    if (!actionMenuMessage || !user) return;
    try {
      const isAdmin = user.accountType === 'admin';
      const isMyMessage = actionMenuMessage.senderId === user.id;

      if (isAdmin && !isMyMessage) {
        // If admin deletes a resident's message, keep the message but replace text
        const { doc, updateDoc } = await import('firebase/firestore');
        const msgRef = doc(db, 'messages', actionMenuMessage.id);
        
        const updates: any = {
          text: 'Pesan telah dihapus oleh Admin.',
          isDeletedByAdmin: true,
          // Clear any attachments
          attachmentUrl: null,
          attachmentName: null,
          attachmentType: null,
          attachmentSize: null,
          replyToId: null,
          replyToSenderName: null,
          replyToText: null
        };
        
        await updateDoc(msgRef, updates);
      } else {
        // Otherwise (user deletes their own message, or admin deletes their own message), delete document completely
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'messages', actionMenuMessage.id));
      }
      setActionMenuMessage(null);
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const getChatUsername = (u: any) => {
    const hasNumericUsername = u.username && /^\d+$/.test(u.username);
    const base = (!hasNumericUsername && u.username) ? u.username : u.name;
    return (u.chatUsername || base || '').slice(0, 10).toLowerCase().replace(/\s+/g, '');
  };

  const handleImageAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : Math.round(file.size / 1024) + ' KB';

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      const img = new window.Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Keep it light for Firestore
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
        setAttachment({
          url: compressedBase64,
          name: file.name,
          type: 'image',
          size: sizeStr
        });
        setIsUploading(false);
      };
    };
    reader.onerror = () => {
      console.error("Gagal membaca gambar");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showAlert('Peringatan', "Ukuran dokumen maksimal adalah 2 MB.", 'warning');
      return;
    }

    setIsUploading(true);
    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : Math.round(file.size / 1024) + ' KB';

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      setAttachment({
        url: base64Str,
        name: file.name,
        type: 'document',
        size: sizeStr
      });
      setIsUploading(false);
    };
    reader.onerror = () => {
      console.error("Gagal membaca dokumen");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch residents for tagging (only if current user is admin)
  useEffect(() => {
    if (!user || user.accountType !== 'admin') return;

    const q = query(
      collection(db, 'users'),
      where('accountType', '==', 'resident')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: User[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as User);
      });
      setResidents(list);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(data.reverse());
      setLoading(false);
      
      if (isInitial.current) {
        setTimeout(() => scrollToBottom('auto'), 50);
        isInitial.current = false;
      } else {
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    scrollRef.current?.scrollIntoView({ behavior });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!inputText.trim() && !attachment)) return;

    const text = inputText.trim();
    setInputText('');

    const displayUsername = user.chatUsername || '';
    const senderDisplayName = user.chatUsername || user.name;
    const msgAttachment = attachment;
    setAttachment(null);

    // AI Moderation check
    const check = containsHarshWords(text, customHarshWords);
    if (check.found) {
      try {
        // 1. Send the censored message on behalf of the user
        await addDoc(collection(db, 'messages'), {
          senderId: user.id,
          senderName: senderDisplayName,
          senderFullName: user.name,
          senderUsername: displayUsername,
          senderPhoto: user.photoUrl || null,
          senderPosition: user.communityPosition || 'Warga',
          isKepalaKeluarga: user.isKepalaKeluarga || false,
          text: 'Pesan telah dihapus oleh Vira karena melanggar pedoman komunitas.',
          createdAt: serverTimestamp(),
          ...(msgAttachment ? {
            attachmentUrl: msgAttachment.url,
            attachmentName: msgAttachment.name,
            attachmentType: msgAttachment.type,
            attachmentSize: msgAttachment.size
          } : {})
        });

        // 2. Send follow-up warning from Vira AI
        const targetSenderName = user.chatUsername ? `@${user.chatUsername}` : user.name;
        await addDoc(collection(db, 'messages'), {
          senderId: 'vira_ai_moderator',
          senderName: 'Vira 🌸',
          senderFullName: 'Vira Community Assistant',
          senderUsername: 'vira.ai',
          senderPhoto: '/vira_ai_avatar.png',
          senderPosition: 'Asisten AI',
          isKepalaKeluarga: false,
          text: `⚠️ **Vira Moderasi**: Pesan dari Kak **${targetSenderName}** terpaksa Vira hapus secara otomatis karena terdeteksi mengandung kata-kata yang kurang sopan. Mari kita saling menghormati dan selalu menjaga kesopanan tutur kata di Forum Ruang Warga 011 VSJ ya, Kak... 😊🌸`,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error during AI moderation handling:', err);
      }
      return;
    }

    if (editingMessage) {
      try {
        await updateDoc(doc(db, 'messages', editingMessage.id), {
          text,
          isEdited: true
        });
        setEditingMessage(null);
      } catch (err) {
        console.error('Error updating message:', err);
      }
      return;
    }

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.id,
        senderName: senderDisplayName,
        senderFullName: user.name,
        senderUsername: displayUsername,
        senderPhoto: user.photoUrl || null,
        senderPosition: user.communityPosition || 'Warga',
        isKepalaKeluarga: user.isKepalaKeluarga || false,
        text,
        createdAt: serverTimestamp(),
        ...(replyingTo ? {
          replyToId: replyingTo.id,
          replyToSenderName: replyingTo.senderFullName || replyingTo.senderName,
          replyToText: replyingTo.text,
        } : {}),
        ...(msgAttachment ? {
          attachmentUrl: msgAttachment.url,
          attachmentName: msgAttachment.name,
          attachmentType: msgAttachment.type,
          attachmentSize: msgAttachment.size
        } : {})
      });
      setReplyingTo(null);

      // Tag parsing & Notification sending for admins
      const isAdmin = user?.accountType === 'admin';
      if (isAdmin) {
        const words = text.split(/\s+/);
        const taggedUsernames = words
          .filter(w => w.startsWith('@'))
          .map(w => w.substring(1).toLowerCase().replace(/[^a-z0-9_]/g, ''));

        if (taggedUsernames.length > 0) {
          residents.forEach(async (res) => {
            const uname = getChatUsername(res);
            if (taggedUsernames.includes(uname)) {
              const displaySenderName = user.chatUsername || user.name || 'Admin';
              await addDoc(collection(db, 'notifications'), {
                type: 'system',
                title: `Anda di-tag oleh ${displaySenderName}`,
                message: text.length > 60 ? text.substring(0, 60) + '...' : text,
                targetId: res.id,
                targetAccountType: 'resident',
                isRead: false,
                userPhotoUrl: user.photoUrl || null,
                createdAt: serverTimestamp(),
                route: '/warga/chat'
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const isAdmin = user?.accountType === 'admin';
    if (isAdmin) {
      const selectionStart = e.target.selectionStart || 0;
      const textBeforeCursor = val.substring(0, selectionStart);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === ' ')) {
        const queryText = textBeforeCursor.substring(lastAtIndex + 1);
        if (!queryText.includes(' ')) {
          setShowTagSuggestions(true);
          setTagQuery(queryText);
          setTagStartIndex(lastAtIndex);
          return;
        }
      }
      setShowTagSuggestions(false);
    }
  };

  const handleSelectTag = (res: User) => {
    const username = getChatUsername(res);
    const textBeforeTag = inputText.substring(0, tagStartIndex);
    const textAfterCursor = inputText.substring(tagStartIndex + tagQuery.length + 1);
    
    setInputText(`${textBeforeTag}@${username} ${textAfterCursor}`);
    setShowTagSuggestions(false);
  };

  const getPositionBadge = (pos?: string) => {
    if (!pos || pos === 'Warga' || pos.toLowerCase() === 'warga') return null;
    const posLower = pos.toLowerCase();
    
    if (posLower === 'ketua_rw') {
      return (
        <span style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#fef3c7', color: '#92400e', 
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          Ketua RW
        </span>
      );
    }
    
    if (posLower === 'ketua_rt' || posLower.startsWith('ketua_rt_')) {
      const rtNum = posLower.startsWith('ketua_rt_') ? posLower.split('_')[2] : '';
      return (
        <span style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#dbeafe', color: '#1e40af', 
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          Ketua RT {rtNum}
        </span>
      );
    }

    if (posLower === 'asisten_ai' || posLower === 'asisten ai') {
      return (
        <span style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#f5f3ff', color: '#6d28d9', 
          border: '1px solid #c084fc',
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 900,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          ✨ Asisten AI
        </span>
      );
    }
    
    return null;
  };

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="chat-container-wrapper"
    >
      <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ 
          background: '#ffffff', 
          borderBottom: '1px solid #e2e8f0', 
          padding: '16px 20px', 
          paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
          display: 'flex', 
          alignItems: 'center', 
          gap: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          transform: 'translate3d(0, 0, 0)',
          WebkitFontSmoothing: 'antialiased',
          backfaceVisibility: 'hidden'
        }}>
          {user && (
            <button 
              type="button"
              onClick={() => navigate(-1)}
              style={{
                background: '#f8fafc',
                border: 'none',
                color: '#1e293b',
                width: 38,
                height: 38,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#1e3a8a', letterSpacing: '-0.5px' }}>Forum Warga VSJ</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Obrolan Komunitas RW 011</div>
          </div>
        </div>

        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 className="animate-spin" color="#1e3a8a" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map((msg) => {
                const isMe = msg.senderId === user.id;
                const badge = getPositionBadge(msg.senderPosition);

                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {!isMe && (
                        <div 
                          onClick={() => setSelectedUser({
                            name: msg.senderFullName || msg.senderName,
                            username: (msg.senderUsername && !/^\d+$/.test(msg.senderUsername)) ? msg.senderUsername : '',
                            photoUrl: msg.senderPhoto,
                            position: msg.senderPosition
                          })}
                          style={{ width: 34, height: 34, borderRadius: '50%', background: badge ? '#1e3a8a' : '#94a3b8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer' }}
                        >
                          {msg.senderPhoto ? <img src={msg.senderPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : msg.senderName.charAt(0)}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {!isMe && (
                          <div style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: '#475569',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            marginLeft: '4px',
                            marginBottom: '2px'
                          }}>
                            <span style={{ fontWeight: 800, color: '#1e3a8a' }}>
                              {(msg.senderUsername && !/^\d+$/.test(msg.senderUsername)) ? (msg.senderId === 'vira_ai_moderator' ? msg.senderName : `@${msg.senderUsername}`) : (msg.senderFullName || msg.senderName || 'Warga')}
                            </span>
                            {badge}
                          </div>
                        )}
                        <div 
                          onTouchStart={() => handleTouchStart(msg)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
                          onMouseDown={() => handleTouchStart(msg)}
                          onMouseUp={handleTouchEnd}
                          onMouseLeave={handleTouchEnd}
                          style={{ 
                            position: 'relative',
                            maxWidth: 'min(88%, 680px)',
                            padding: msg.attachmentUrl && !msg.text ? '10px 10px 26px 10px' : '10px 14px 26px 14px', 
                            borderRadius: isMe ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                            background: isMe ? '#1e3a8a' : '#fff', color: isMe ? '#fff' : '#1e293b',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: 14, lineHeight: 1.5,
                            textAlign: 'left',
                            minWidth: '95px',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          {msg.replyToId && (
                            <div style={{
                              background: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                              borderLeft: `3px solid ${isMe ? '#93c5fd' : '#1e3a8a'}`,
                              padding: '6px 10px',
                              borderRadius: '4px 8px 8px 4px',
                              marginBottom: 8,
                              fontSize: 11,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2
                            }}>
                              <span style={{ fontWeight: 800, color: isMe ? '#bfdbfe' : '#1e3a8a' }}>{msg.replyToSenderName}</span>
                              <span style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyToText || 'Gambar/Dokumen'}</span>
                            </div>
                          )}
                          {msg.attachmentUrl && (
                            <div style={{ marginBottom: msg.text ? 10 : 0 }}>
                              {msg.attachmentType === 'image' ? (
                                <div 
                                  onClick={() => setSelectedImage(msg.attachmentUrl || null)}
                                  style={{ 
                                    width: '100%', 
                                    maxHeight: 200, 
                                    borderRadius: 12, 
                                    overflow: 'hidden', 
                                    cursor: 'pointer',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                  }}
                                >
                                  <img src={msg.attachmentUrl} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  background: isMe ? 'rgba(255,255,255,0.1)' : '#f8fafc',
                                  padding: '8px 12px',
                                  borderRadius: 12,
                                  border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e2e8f0',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                    <File size={20} color={isMe ? '#fff' : '#2563eb'} style={{ flexShrink: 0 }} />
                                    <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                      <div style={{ 
                                        fontSize: 11, 
                                        fontWeight: 800, 
                                        color: isMe ? '#fff' : '#1e293b', 
                                        whiteSpace: 'nowrap', 
                                        textOverflow: 'ellipsis', 
                                        overflow: 'hidden' 
                                      }}>{msg.attachmentName}</div>
                                      <div style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.7)' : '#64748b', fontWeight: 600 }}>{msg.attachmentSize}</div>
                                    </div>
                                  </div>
                                  <a 
                                    href={msg.attachmentUrl} 
                                    download={msg.attachmentName}
                                    style={{ 
                                      color: isMe ? '#fff' : '#2563eb', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: isMe ? 'rgba(255,255,255,0.15)' : '#eff6ff',
                                      flexShrink: 0
                                    }}
                                  >
                                    <Download size={14} />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {msg.text && (
                            <div style={{ 
                              wordBreak: 'break-word', 
                              whiteSpace: 'pre-wrap',
                              fontStyle: (msg.text.includes('dihapus oleh Vira') || msg.text.includes('dihapus oleh Admin')) ? 'italic' : 'normal',
                              opacity: (msg.text.includes('dihapus oleh Vira') || msg.text.includes('dihapus oleh Admin')) ? 0.75 : 1
                            }}>
                              <span>{formatMessageText(msg.text)}</span>
                            </div>
                          )}

                          <span style={{ 
                            position: 'absolute',
                            bottom: '6px',
                            right: '12px',
                            fontSize: 9, 
                            opacity: 0.65, 
                            fontWeight: 700,
                            color: isMe ? '#ffffff' : '#64748b',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            userSelect: 'none'
                          }}>
                            {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '...'}
                            {msg.isEdited && <span style={{ fontStyle: 'italic', fontSize: 8 }}> (diedit)</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        <div className="chat-footer" style={{ 
          borderTop: '1px solid #e2e8f0', 
          background: '#fff',
          padding: 0,
          paddingBottom: (isMobile && user?.accountType === 'resident' && !isKeyboardOpen) ? '86px' : '0px'
        }}>
          {attachment && (
            <div style={{
              padding: '10px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                {attachment.type === 'image' ? (
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                    <img src={attachment.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe', flexShrink: 0 }}>
                    <FileText size={18} />
                  </div>
                )}
                <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{attachment.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{attachment.size} • Siap dikirim</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#e2e8f0',
                  border: 'none',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {(replyingTo || editingMessage) && (
            <div style={{
              padding: '8px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                <div style={{ color: '#2563eb' }}>
                  <MessageSquare size={16} />
                </div>
                <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb' }}>
                    {editingMessage ? 'Mengedit pesan' : `Membalas ke ${replyingTo?.senderFullName || replyingTo?.senderName}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {editingMessage ? editingMessage.text : (replyingTo?.text || 'Gambar/Dokumen')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setReplyingTo(null); setEditingMessage(null); setInputText(''); }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#e2e8f0',
                  border: 'none',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div style={{ padding: isMobile ? '12px 14px' : '16px 20px' }}>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  disabled={isUploading}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    background: showAttachmentMenu ? '#eff6ff' : '#f8fafc',
                    color: showAttachmentMenu ? '#2563eb' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                >
                  {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
                </button>

                {/* Floating Popup Attachment Menu */}
                {showAttachmentMenu && (
                  <>
                    <div 
                      onClick={() => setShowAttachmentMenu(false)}
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 990
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 48,
                      left: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 16,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 1000,
                      width: 130
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          fileInputRef.current?.click();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          border: 'none',
                          background: 'none',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: 10,
                          width: '100%',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <Image size={14} color="#3b82f6" />
                        <span>Gambar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          docInputRef.current?.click();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          border: 'none',
                          background: 'none',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: 10,
                          width: '100%',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <FileText size={14} color="#10b981" />
                        <span>Dokumen</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleImageAttachment} 
              />
              <input 
                type="file" 
                ref={docInputRef} 
                accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.pptx,.ppt" 
                style={{ display: 'none' }} 
                onChange={handleDocumentAttachment} 
              />

              <div style={{ flex: 1, position: 'relative' }}>
                <input 
                  className="form-input" 
                  placeholder="Tulis pesan..." 
                  style={{ width: '100%', height: 40, borderRadius: 12, paddingLeft: 14, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13 }} 
                  value={inputText} 
                  onChange={handleInputChange} 
                />

                {showTagSuggestions && (
                  <div style={{
                    position: 'absolute',
                    bottom: '48px',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    textAlign: 'left'
                  }}>
                    {residents
                      .filter(res => {
                        const uname = getChatUsername(res);
                        return uname.includes(tagQuery.toLowerCase()) || res.name.toLowerCase().includes(tagQuery.toLowerCase());
                      })
                      .map(res => {
                        const uname = getChatUsername(res);
                        return (
                          <div 
                            key={res.id}
                            onClick={() => handleSelectTag(res)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              borderBottom: '1px solid #f1f5f9',
                              fontSize: '13px'
                            }}
                          >
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: '#fff', overflow: 'hidden' }}>
                              {res.photoUrl ? <img src={res.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : res.name.charAt(0)}
                            </div>
                            <div>
                              <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{res.name}</span>{' '}
                              <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>@{uname}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: 40, height: 40, borderRadius: 12, padding: 0, justifyContent: 'center', boxShadow: '0 4px 12px rgba(30,58,138,0.2)', flexShrink: 0 }} 
                disabled={(!inputText.trim() && !attachment) || isUploading}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 360, borderRadius: 28, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
            <button 
              type="button"
              onClick={() => setSelectedUser(null)} 
              style={{ position: 'absolute', top: 20, right: 20, background: '#f1f5f9', border: 'none', color: '#64748b', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 14 }}
            >
              ✕
            </button>
            
            <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', border: '4px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a8a', color: '#fff', fontSize: 36, fontWeight: 900 }}>
              {selectedUser.photoUrl ? (
                <img src={selectedUser.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                selectedUser.name.charAt(0)
              )}
            </div>

            <div style={{ display: 'inline-block', marginBottom: 12 }}>
              {getPositionBadge(selectedUser.position) || (
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>👤 Warga</span>
              )}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>{selectedUser.name}</h3>
            {selectedUser.username && (
              <p style={{ color: '#2563eb', fontSize: 14, fontWeight: 800, margin: 0, fontFamily: 'monospace' }}>@{selectedUser.username}</p>
            )}
            
            <div style={{ marginTop: 24, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <button 
                type="button"
                onClick={() => setSelectedUser(null)}
                style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15,23,42,0.95)', 
            backdropFilter: 'blur(12px)', 
            zIndex: 8000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 20,
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button 
              type="button"
              onClick={() => setSelectedImage(null)} 
              style={{ 
                position: 'absolute', 
                top: -44, 
                right: 0, 
                background: 'rgba(255,255,255,0.2)', 
                border: 'none', 
                color: '#fff', 
                width: 36, 
                height: 36, 
                borderRadius: '50%', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 'bold', 
                fontSize: 16 
              }}
            >
              ✕
            </button>
            <img src={selectedImage} alt="Attachment Full" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
          </div>
        </div>
      )}

      {actionMenuMessage && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setActionMenuMessage(null)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', maxWidth: 320, borderRadius: 24, padding: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <div style={{ padding: '8px 12px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Opsi Pesan</div>
              <div style={{ fontSize: 13, color: '#1e293b', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>"{actionMenuMessage.text || 'Gambar/Dokumen'}"</div>
            </div>

            <button
              onClick={() => { setReplyingTo(actionMenuMessage); setActionMenuMessage(null); setTimeout(() => document.querySelector<HTMLInputElement>('.form-input')?.focus(), 100); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: 'none', background: 'none', color: '#1e293b', fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <MessageSquare size={18} color="#2563eb" />
              Balas Pesan
            </button>

            {actionMenuMessage.senderId === user.id && (
              <button
                onClick={() => { setEditingMessage(actionMenuMessage); setInputText(actionMenuMessage.text || ''); setActionMenuMessage(null); setTimeout(() => document.querySelector<HTMLInputElement>('.form-input')?.focus(), 100); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: 'none', background: 'none', color: '#1e293b', fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <FileText size={18} color="#10b981" />
                Edit Pesan
              </button>
            )}

            {(actionMenuMessage.senderId === user.id || user.accountType === 'admin') && (
              <button
                onClick={handleDeleteMessage}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: 'none', background: 'none', color: '#ef4444', fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <X size={18} color="#ef4444" />
                Hapus Pesan
              </button>
            )}
          </motion.div>
        </div>
      )}

      <style>{`
        .chat-page-main-area {
          padding: 0 !important;
          margin: 0 !important;
          height: 100vh !important;
          background: #f1f5f9 !important;
          width: 100% !important;
          overflow: hidden !important;
        }
        .chat-page-content {
          padding: 0 !important;
          margin: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        /* Lock all parent layouts to prevent body-scroll on mobile/APK */
        html, body, #root, .app-layout, .main-area, .page-content, .chat-page-content-wrapper {
          height: 100% !important;
          max-height: 100% !important;
          overflow: hidden !important;
        }
        .chat-container-wrapper { 
          height: 100% !important;
          max-height: 100% !important;
          background: #f1f5f9; 
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          perspective: 1000px;
          overflow: hidden !important;
        }
        .chat-container {
          max-width: 850px;
          width: 100%;
          margin: 0 auto;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          height: 100% !important;
          max-height: 100% !important;
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
        }
        .chat-messages { padding: 24px; }
        .chat-footer { padding: 20px 24px; }
        
        /* On desktop (width > 768px), clear the persistent 260px sidebar for admin */
        @media (min-width: 769px) {
          .app-layout:not(.is-resident) .chat-page-main-area {
            padding-left: 260px;
          }
        }
        
        @media (max-width: 768px) { 
          .chat-page-main-area {
            padding: 0 !important;
            margin: 0 !important;
            padding-left: 0 !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }
          .chat-page-content {
            margin-top: 0 !important; /* Forces 0 margin-top on mobile chat to avoid white gap */
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }
          .chat-container-wrapper { 
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          } 
          .chat-container {
            max-width: 100%;
            border-left: none;
            border-right: none;
            box-shadow: none;
            height: 100% !important;
          }
          .chat-messages { padding: 16px 12px; }
          .chat-footer { padding: 12px 14px; }
        }
      `}</style>
    </motion.div>
  );
}
