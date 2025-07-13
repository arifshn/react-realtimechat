import React, { useState } from "react";
import { db } from "../firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import "bootstrap/dist/css/bootstrap.min.css";

export default function ProfileSetup({ user, onComplete }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username.trim()) {
      setError("Kullanıcı adı boş bırakılamaz.");
      setLoading(false);
      return;
    }

    const userRef = doc(db, "users", user.uid);

    try {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          username: username.trim(),
          lastActive: serverTimestamp(),
          isOnline: true,
        },
        { merge: true }
      );
      console.log("Kullanıcı profili başarıyla kaydedildi!");
      onComplete();
    } catch (err) {
      console.error("Kullanıcı profili kaydedilirken hata oluştu:", err);
      let errorMessage = "Profil kaydedilirken beklenmedik bir hata oluştu.";
      if (err.message.includes("permission-denied")) {
        errorMessage =
          "Profilinizi kaydetmek için yetkiniz yok. Güvenlik kurallarınızı kontrol edin.";
      } else if (err.message.includes("invalid-argument")) {
        errorMessage = "Geçersiz veri girişi. Lütfen kontrol edin.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="card shadow-lg p-4"
      style={{ maxWidth: "400px", width: "100%" }}
    >
      <h3 className="card-title text-center mb-4 text-primary">
        Profilini Tamamla 🚀
      </h3>
      <form onSubmit={handleSave}>
        <div className="form-group mb-4">
          <label htmlFor="usernameInput" className="form-label">
            Kullanıcı Adı
          </label>
          <input
            type="text"
            className="form-control"
            id="usernameInput"
            placeholder="Kullanıcı adınızı girin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
          className="btn btn-primary w-100"
          disabled={loading}
        >
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
