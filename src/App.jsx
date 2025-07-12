import { useEffect, useState } from "react";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import "bootstrap/dist/css/bootstrap.min.css";

import Auth from "./components/Auth";
import ProfileSetup from "./components/ProfileSetup";
import UserList from "./components/UserList";
import ChatBox from "./components/ChatBox";

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserList, setShowUserList] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);

        await setDoc(userRef, { isOnline: true }, { merge: true });

        const handleOffline = async () => {
          await setDoc(userRef, { isOnline: false }, { merge: true });
        };
        window.addEventListener("beforeunload", handleOffline);

        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    console.log("User logged in:", loggedInUser?.email);
  };

  const handleProfileSetupComplete = async () => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setShowUserList(false);
  };

  if (!user) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light p-3">
        <Auth onLogin={handleLoginSuccess} />
      </div>
    );
  }

  if (user && userData === null) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light p-3">
        <ProfileSetup user={user} onComplete={handleProfileSetupComplete} />
      </div>
    );
  }

  return (
    <div className="container-fluid h-100 d-flex flex-column bg-light">
      <div className="row flex-grow-1 no-gutters">
        {" "}
        <div
          className={`col-12 col-md-4 col-lg-3 bg-white border-right d-flex flex-column shadow-sm ${
            !showUserList ? "d-none d-md-flex" : ""
          }`}
        >
          <div className="p-3 border-bottom d-flex align-items-center">
            <h5 className="mb-0 text-primary flex-grow-1">
              Merhaba, {userData.username}
            </h5>
            <button
              onClick={() => signOut(auth)}
              className="btn btn-outline-danger btn-sm"
            >
              Çıkış Yap
            </button>
          </div>
          <p className="px-3 py-2 text-muted small border-bottom">
            {user.email}
          </p>
          <div className="flex-grow-1 overflow-auto">
            <UserList currentUser={userData} onSelectUser={handleSelectUser} />
          </div>
        </div>
        <div
          className={`col-12 col-md-8 col-lg-9 d-flex flex-column p-0 ${
            showUserList ? "d-none d-md-flex" : ""
          }`}
        >
          {selectedUser ? (
            <>
              <div className="d-md-none p-2 border-bottom bg-white">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowUserList(true)}
                >
                  &larr; Geri
                </button>
                <span className="ml-3 font-weight-bold">
                  {selectedUser.username} ile Sohbet
                </span>
              </div>
              <ChatBox currentUser={userData} selectedUser={selectedUser} />
            </>
          ) : (
            <div className="d-flex flex-grow-1 justify-content-center align-items-center text-muted">
              <p>Sohbet etmek için bir kullanıcı seçin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
