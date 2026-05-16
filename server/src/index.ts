import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Cloudinary signature endpoint
app.post('/api/cloudinary-signature', (req: Request, res: Response) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const { folder } = req.body;
  
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!
  );

  res.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME
  });
});


// Initialize Firebase Admin (needs serviceAccountKey.json)
// admin.initializeApp();

app.get('/', (req: Request, res: Response) => {
  res.send('Ruang Warga 011 API Server is running (TypeScript + Node.js)');
});

// Example route for analytics (can be expanded)
app.get('/api/analytics/summary', async (req: Request, res: Response) => {
  try {
    // Logic to fetch data from Firestore using Admin SDK
    res.json({
      status: 'success',
      data: {
        totalFamilies: 12,
        totalResidents: 45,
        activeRate: '92.1%'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`[server]: Server is running at http://0.0.0.0:${port}`);
});

