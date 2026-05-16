/**
 * faceService.ts
 * Real face detection and cropping using face-api.js (browser-based ML)
 * Models are loaded from CDN - no server required
 */
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/**
 * Detect faces in an image file and return a cropped face as base64
 * Used to extract the photo from KTP (ID card)
 */
export async function detectAndCropFace(imageFile: File): Promise<string | null> {
  await loadFaceModels();

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const detection = await faceapi
          .detectSingleFace(canvas)
          .withFaceLandmarks();

        if (!detection) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        // Add padding around the face for better crop
        const box = detection.detection.box;
        const padding = Math.max(box.width, box.height) * 0.3;
        const cropX = Math.max(0, box.x - padding);
        const cropY = Math.max(0, box.y - padding * 1.5);
        const cropW = Math.min(img.width - cropX, box.width + padding * 2);
        const cropH = Math.min(img.height - cropY, box.height + padding * 2);

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 200;
        faceCanvas.height = 200;
        const faceCtx = faceCanvas.getContext('2d')!;
        faceCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, 200, 200);

        URL.revokeObjectURL(url);
        resolve(faceCanvas.toDataURL('image/jpeg', 0.8));
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.src = url;
  });
}

/**
 * Compare face from live camera with stored face descriptor
 * Returns confidence score 0-1 (1 = perfect match)
 */
export async function compareFaces(
  liveImageData: ImageData | HTMLVideoElement,
  storedDescriptor: Float32Array
): Promise<number> {
  await loadFaceModels();
  
  const detection = await faceapi
    .detectSingleFace(liveImageData as any)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return 0;

  const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);
  // Convert distance to confidence: distance 0 = 100%, distance 0.6+ = 0%
  const confidence = Math.max(0, 1 - distance / 0.6);
  return confidence;
}

/**
 * Get face descriptor from a video element (used for login verification)
 */
export async function getFaceDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  await loadFaceModels();
  const detection = await faceapi
    .detectSingleFace(video)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}
