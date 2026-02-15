import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAgHgJz5MOWpHP5ImRQk8SLKMxHAiF5oIk",
  authDomain: "clickprato-aut5.firebaseapp.com",
  projectId: "clickprato-aut5",
  storageBucket: "clickprato-aut5.firebasestorage.app",
  messagingSenderId: "875780046357",
  appId: "1:875780046357:web:84d34a3fbcc8715c83d81c",
};

// --- LOG DE PROVA ---
// Este log aparecerá no console do navegador (F12) após o build na Vercel.
console.log("%c🔥 DEBUG FIREBASE:", "color: white; background: #ff9900; font-weight: bold; padding: 4px;", {
  projeto_atual: firebaseConfig.projectId,
  domínio: firebaseConfig.authDomain,
  timestamp: new Date().toISOString()
});
// --------------------

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);

// Exportar o serviço de autenticação
export const auth = getAuth(app);

// Inicializar o Firestore
export const db = getFirestore(app);

// Inicializar Analytics somente no navegador para evitar erros em SSR
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;
