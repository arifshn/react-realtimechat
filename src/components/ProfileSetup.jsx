import { useState } from "react";
import { db } from "../firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import "bootstrap/dist/css/bootstrap.min.css";

export default function ProfileSetup({ user, onComplete }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Kullanıcı adı boş bırakılamaz.");
      return;
    }

    const userRef = doc(db, "users", user.uid);

    try {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          username,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("User profile saved successfully!");
      onComplete();
    } catch (error) {
      console.error("Error saving user profile:", error);
      setError("Profil kaydedilirken bir hata oluştu: " + error.message);
    }
  };

  return (
    <div
      className="card shadow-lg p-4"
      style={{ maxWidth: "400px", width: "100%" }}
    >
      <h3 className="card-title text-center mb-4 text-primary">
        Profilini Tamamla
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
          />
        </div>
        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary w-100">
          Kaydet
        </button>
      </form>
    </div>
  );
}
