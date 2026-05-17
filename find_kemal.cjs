const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
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

async function findKemal() {
  let log = "";
  const logMsg = (msg) => {
    console.log(msg);
    log += msg + "\n";
  };

  logMsg("Querying by NIK '3172030404050006' in residents...");
  const q1 = query(collection(db, 'residents'), where('nik', '==', '3172030404050006'));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    snap1.forEach(doc => {
      logMsg(`RESIDENT BY NIK: ${doc.id} => ${JSON.stringify(doc.data(), null, 2)}`);
    });
  } else {
    logMsg("No resident found by NIK!");
  }

  logMsg("Querying by name 'MUHAMMAD KEMAL AFRILIDZI' in residents...");
  const q2 = query(collection(db, 'residents'), where('nama', '==', 'MUHAMMAD KEMAL AFRILIDZI'));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    snap2.forEach(doc => {
      logMsg(`RESIDENT BY NAME: ${doc.id} => ${JSON.stringify(doc.data(), null, 2)}`);
    });
  } else {
    logMsg("No resident found by name!");
  }

  fs.writeFileSync('kemal_res.txt', log, 'utf8');
  process.exit(0);
}

findKemal().catch(err => {
  console.error(err);
  process.exit(1);
});
