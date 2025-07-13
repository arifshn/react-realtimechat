import React, { useState } from "react";
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
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case "auth/email-already-in-use":
        return "Bu e-posta adresi zaten kullanımda.";
      case "auth/invalid-email":
        return "Geçersiz e-posta adresi formatı.";
      case "auth/operation-not-allowed":
        return "E-posta/şifre ile giriş devre dışı bırakılmış.";
      case "auth/weak-password":
        return "Şifre en az 6 karakter olmalıdır.";
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Geçersiz e-posta veya şifre.";
      case "auth/network-request-failed":
        return "İnternet bağlantınızda bir sorun var. Lütfen tekrar deneyin.";
      default:
        return "Bir hata oluştu. Lütfen tekrar deneyin.";
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!username.trim()) {
          setError("Lütfen geçerli bir kullanıcı adı girin.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Şifre en az 6 karakter uzunluğunda olmalıdır.");
          setLoading(false);
          return;
        }

        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email,
          username: username.trim(),
          createdAt: serverTimestamp(),
          isOnline: true,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (err) {
      setError(getFriendlyErrorMessage(err.code));
      console.error("Kimlik doğrulama hatası:", err);
    } finally {
      setLoading(false);
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
        {isRegister && (
          <div className="form-group mb-3">
            <label htmlFor="usernameInput" className="form-label">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              className="form-control"
              id="usernameInput"
              placeholder="Kullanıcı adınız"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        )}
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
            disabled={loading}
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
            disabled={loading}
          />
        </div>
        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary w-100 mb-3"
          disabled={loading}
        >
          {loading
            ? isRegister
              ? "Kaydolunuyor..."
              : "Giriş Yapılıyor..."
            : isRegister
            ? "Kayıt Ol"
            : "Giriş Yap"}
        </button>
      </form>
      <p className="text-center mt-3">
        {isRegister ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}{" "}
        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setError(null);
          }}
          className="btn btn-link p-0 align-baseline"
          disabled={loading}
        >
          {isRegister ? "Giriş Yap" : "Kayıt Ol"}
        </button>
      </p>
    </div>
  );
}
