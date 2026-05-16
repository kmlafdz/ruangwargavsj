const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyDbZLOCguZj4MmP4xbQrr6gln1arIdXhAg",
  authDomain: "ruang-warga-011-2607a.firebaseapp.com",
  projectId: "ruang-warga-011-2607a",
  storageBucket: "ruang-warga-011-2607a.firebasestorage.app",
  messagingSenderId: "574180261299",
  appId: "1:574180261299:web:f3a70b13ff1bc78e595fc6",
  measurementId: "G-GGXZEC2V4N"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedData() {
  const data = JSON.parse(fs.readFileSync('c:/Users/ThinkPad/.gemini/antigravity/scratch/rw-project/dummy_residents_400.json', 'utf8'));
  console.log(`Starting to upload ${data.length} records...`);

  for (let i = 0; i < data.length; i++) {
    const res = data[i];
    try {
      // Use setDoc with a custom ID or addDoc
      await setDoc(doc(db, 'residents', res.id), {
        ...res,
        createdAt: new Date()
      });
      if ((i + 1) % 50 === 0) {
        console.log(`Uploaded ${i + 1} records...`);
      }
    } catch (e) {
      console.error(`Error uploading ${res.nama}:`, e.message);
    }
  }

  console.log('Successfully seeded 400 residents to Firestore!');
  process.exit(0);
}

seedData();
