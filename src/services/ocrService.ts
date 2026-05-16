/**
 * ocrService.ts
 * Advanced KTP OCR System using Tesseract.js and OpenCV.js
 */
import Tesseract from 'tesseract.js';

declare const cv: any; // OpenCV from CDN

export interface KTPData {
  nik: string;
  nama: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  alamat: string;
  rtRw: string;
  kelDesa: string;
  kecamatan: string;
  agama: string;
  statusPerkawinan: string;
  pekerjaan: string;
  kewarganegaraan: string;
  nomorKK: string;
  facePhotoBase64?: string;
  confidence: number;
}

export interface OCRResult {
  rawText: string;
  ktpData: Partial<KTPData>;
  confidence: number;
  processedImage: string;
}

/**
 * Wait for OpenCV to be ready with a timeout
 */
export async function waitForOpenCV(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof cv !== 'undefined' && cv.ready) {
      resolve(true);
      return;
    }
    
    let elapsed = 0;
    const check = setInterval(() => {
      elapsed += 100;
      if (typeof cv !== 'undefined' && cv.ready) {
        clearInterval(check);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(check);
        console.warn('OpenCV load timeout');
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Advanced Preprocessing using OpenCV.js with Fallback
 */
async function opencvPreprocess(file: File): Promise<{ url: string; isBlurry: boolean }> {
  const isReady = await waitForOpenCV(3000);
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = () => {
        // Fallback if OpenCV not ready
        if (!isReady || typeof cv === 'undefined' || !cv.Mat) {
          console.warn('Using fallback preprocessing (OpenCV not ready)');
          resolve({ url: img.src, isBlurry: false });
          return;
        }

        try {
          const src = cv.imread(img);
          const dst = new cv.Mat();
          const gray = new cv.Mat();
          
          // 1. Grayscale
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
          
          // 2. Blur Detection
          const lap = new cv.Mat();
          cv.Laplacian(gray, lap, cv.CV_64F);
          const mean = new cv.Mat();
          const stddev = new cv.Mat();
          cv.meanStdDev(lap, mean, stddev);
          const variance = stddev.data64F[0] * stddev.data64F[0];
          const isBlurry = variance < 100;
          
          // 3. Contrast Enhancement (CLAHE)
          const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
          clahe.apply(gray, gray);
          
          // 4. Adaptive Thresholding
          cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

          const canvas = document.createElement('canvas');
          cv.imshow(canvas, dst);
          const url = canvas.toDataURL('image/jpeg', 0.9);
          
          // Cleanup
          src.delete(); dst.delete(); gray.delete(); lap.delete(); mean.delete(); stddev.delete();
          resolve({ url, isBlurry });
        } catch (err) {
          console.error('OpenCV processing error:', err);
          resolve({ url: img.src, isBlurry: false });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Detect and Crop Face from KTP using OpenCV
 */
async function detectAndCropFace(imgElement: HTMLImageElement): Promise<string> {
  try {
    const isReady = await waitForOpenCV(2000);
    if (!isReady || typeof cv === 'undefined') throw new Error('OpenCV not ready');
    
    const src = cv.imread(imgElement);
    // Typical KTP face location: right side, middle-ish
    // Let's try a heuristic crop first (top: 20%, left: 65%, width: 30%, height: 40%)
    const rect = new cv.Rect(
      Math.floor(src.cols * 0.65), 
      Math.floor(src.rows * 0.15), 
      Math.floor(src.cols * 0.30), 
      Math.floor(src.rows * 0.45)
    );
    
    const face = src.roi(rect);
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, face);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    
    src.delete(); face.delete();
    return base64;
  } catch (err) {
    console.error('Face detection error (OpenCV):', err);
    
    // Fallback to Canvas API if OpenCV fails
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      
      const w = Math.floor(imgElement.width * 0.30);
      const h = Math.floor(imgElement.height * 0.45);
      const x = Math.floor(imgElement.width * 0.65);
      const y = Math.floor(imgElement.height * 0.15);
      
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(imgElement, x, y, w, h, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (fallbackErr) {
      console.error('Face detection fallback error:', fallbackErr);
      return '';
    }
  }
}


export async function extractKTPData(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  // 1. Advanced Preprocessing
  const { url: processedImage, isBlurry } = await opencvPreprocess(imageFile);
  
  if (isBlurry) {
    console.warn('Image might be blurry, results may be inaccurate');
  }

  // 2. OCR with Tesseract
  const { data } = await Tesseract.recognize(processedImage, 'ind', {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  const text = data.text;
  
  // 3. Field Extraction with Robust Regex
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  
  const nik = text.match(/\b\d{16}\b/)?.[0] || '';
  
  // Name usually after 'Nama' or the longest all-caps line
  let nama = (text.match(/(?:Nama|Noma)\s*[:;=1]?\s*([A-Z\s,.]+)/i)?.[1] || '').trim().split('\n')[0];
  if (!nama) {
    const capsLines = lines.filter(l => /^[A-Z\s,]{5,30}$/.test(l));
    if (capsLines.length > 0) nama = capsLines[0];
  }

  // TTL: KOTA, DD-MM-YYYY
  const ttlRaw = text.match(/(?:Lahir|Lohir)\s*[:;=1]?\s*([A-Z\s,]+[A-Z]\s*,\s*\d{2}-\d{2}-\d{4})/i)?.[1] || '';
  let tempatLahir = '';
  let tanggalLahir = '';
  if (ttlRaw.includes(',')) {
    const parts = ttlRaw.split(',');
    tempatLahir = parts[0].trim();
    const dateMatch = parts[1].match(/(\d{2})-(\d{2})-(\d{4})/);
    if (dateMatch) {
      tanggalLahir = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
  } else {
    // Fallback date search
    const dm = text.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (dm) tanggalLahir = `${dm[3]}-${dm[2]}-${dm[1]}`;
  }

  const jkMatch = text.match(/Jenis\s*Kelamin\s*[:;=1]?\s*(LAKI-LAKI|PEREMPUAN)/i);
  const alamat = text.match(/Alamat\s*[:;=1]?\s*(.+?)(?=\n|RT\/RW)/is)?.[1]?.trim() || '';
  const rtrw = text.match(/(?:RT\/RW|RT\/PW)\s*[:;=1]?\s*(\d{3}\/\d{3})/i)?.[1] || '';
  const kel = text.match(/(?:Kel\/Desa|Kelurahan)\s*[:;=1]?\s*([A-Z\s]+)/i)?.[1]?.trim() || '';
  const kec = text.match(/Kecamatan\s*[:;=1]?\s*([A-Z\s]+)/i)?.[1]?.trim() || '';
  const agama = text.match(/Agama\s*[:;=1]?\s*([A-Z]+)/i)?.[1]?.trim() || '';
  const status = text.match(/Perkawinan\s*[:;=1]?\s*([A-Z\s]+)/i)?.[1]?.trim() || '';
  const kerja = text.match(/Pekerjaan\s*[:;=1]?\s*([A-Z\s]+)/i)?.[1]?.trim() || '';
  const wn = text.match(/Kewarganegaraan\s*[:;=1]?\s*([A-Z]+)/i)?.[1]?.trim() || '';
  
  // Try to find 16-digit KK number (often near "NOMOR" or "KK")
  const nomorKK = text.match(/(?:No|Nomor|KK)\.?\s*[:;=]?\s*(\d{16})/i)?.[1] || 
                 text.match(/\b\d{16}\b/g)?.find(n => n !== nik) || '';

  // 4. Face Detection (from original or processed)
  const img = new Image();
  img.src = processedImage;
  await new Promise(r => img.onload = r);
  const facePhotoBase64 = await detectAndCropFace(img);

  const ktpData: Partial<KTPData> = {
    nik,
    nama: nama.replace(/[^A-Z\s]/g, '').trim(),
    tempatLahir,
    tanggalLahir,
    jenisKelamin: jkMatch?.[1]?.toUpperCase() || '',
    alamat,
    rtRw: rtrw,
    kelDesa: kel,
    kecamatan: kec,
    agama,
    statusPerkawinan: status,
    pekerjaan: kerja,
    kewarganegaraan: wn,
    nomorKK,
    facePhotoBase64,
    confidence: data.confidence,
  };

  return { rawText: text, ktpData, confidence: data.confidence, processedImage };
}

export function calculateMatchScore(
  input: { nik: string; fullName: string; birthDate: string },
  ocr: Partial<KTPData>
): number {
  let score = 0;
  let total = 0;

  if (input.nik) {
    total += 40;
    if (input.nik === ocr.nik) score += 40;
    else if (ocr.nik?.includes(input.nik.slice(0, 10))) score += 20;
  }

  if (input.fullName) {
    total += 40;
    const inputName = input.fullName.toUpperCase().trim();
    const ocrName = ocr.nama?.toUpperCase().trim() || '';
    if (inputName === ocrName) score += 40;
    else {
      const matched = inputName.split(' ').filter(w => ocrName.includes(w)).length;
      score += Math.min(40, (matched / inputName.split(' ').length) * 40);
    }
  }

  if (input.birthDate && ocr.tanggalLahir) {
    total += 20;
    if (input.birthDate === ocr.tanggalLahir) score += 20;
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
}
