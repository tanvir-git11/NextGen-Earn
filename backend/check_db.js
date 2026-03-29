const { db } = require('./firebase/firebaseAdmin');

async function checkDeposits() {
  try {
    const snapshot = await db.collection('deposits').orderBy('createdAt', 'desc').limit(5).get();
    console.log('--- Latest Deposits ---');
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', JSON.stringify(doc.data(), null, 2));
    });
    
    const usersSnap = await db.collection('users').limit(5).get();
    console.log('--- Sample Users ---');
    usersSnap.forEach(doc => {
      console.log(doc.id, '=>', doc.data().name, '| Balance:', doc.data().balance);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

checkDeposits();
