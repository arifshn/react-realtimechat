import { useState } from "react";
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div
      className="card shadow-lg p-4"
      style={{ maxWidth: "400px", width: "100%" }}
    >
      <h2 className="card-title text-center mb-4 text-primary">
        {isRegister ? "Kayıt Ol" : "Giriş Yap"}
      </h2>
      <form onSubmit={handleAuth}>
        <div className="form-group mb-3">
          <label htmlFor="emailInput" className="form-label">
            E-posta Adresi
          </label>
          <input
            type="email"
            className="form-control"
            id="emailInput"
            placeholder="ornek@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group mb-4">
          <label htmlFor="passwordInput" className="form-label">
            Şifre
          </label>
          <input
            type="password"
            className="form-control"
            id="passwordInput"
            placeholder="Şifrenizi girin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary w-100 mb-3">
          {isRegister ? "Kayıt Ol" : "Giriş Yap"}
        </button>
      </form>
      <p className="text-center mt-3">
        {isRegister ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}{" "}
        <button
          onClick={() => setIsRegister(!isRegister)}
          className="btn btn-link p-0 align-baseline"
        >
          {isRegister ? "Giriş Yap" : "Kayıt Ol"}
        </button>
      </p>
    </div>
  );
}
