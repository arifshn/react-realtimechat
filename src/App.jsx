import React, { useEffect, useState } from "react";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, onDisconnect, set } from "firebase/database";
import { realtimeDb } from "./firebaseConfig";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

import Auth from "./components/Auth";
import ProfileSetup from "./components/ProfileSetup";
import UserList from "./components/UserList";
import ChatBox from "./components/ChatBox";
import CreateGroup from "./components/CreateGroup";

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showUserList, setShowUserList] = useState(true);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);

        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          setUserData(userSnap.data());

          await updateDoc(userDocRef, { isOnline: true });

          const isOnlineForUserRef = ref(
            realtimeDb,
            `/status/${currentUser.uid}/isOnline`
          );
          const lastChangedForUserRef = ref(
            realtimeDb,
            `/status/${currentUser.uid}/lastChanged`
          );

          onDisconnect(isOnlineForUserRef)
            .set(false)
            .then(() => {
              onDisconnect(lastChangedForUserRef).set(serverTimestamp());
            });

          set(isOnlineForUserRef, true);
          set(lastChangedForUserRef, serverTimestamp());
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
        setSelectedChat(null);
        setShowUserList(true);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const handleProfileSetupComplete = async () => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
        await updateDoc(userRef, { isOnline: true });
      }
    }
  };

  const handleSelectChat = (chatItem) => {
    setSelectedChat(chatItem);
    setShowUserList(false);
  };

  const handleGroupCreated = (newGroup) => {
    setSelectedChat(newGroup);
    setShowCreateGroupModal(false);
    setShowUserList(false);
    console.log("Yeni grup oluşturuldu:", newGroup);
  };

  // Buraya eklendi: Gruptan çıkınca seçili sohbeti kaldır
  const handleLeaveGroup = (leftGroupId) => {
    // Eğer çıkılan grup seçili grup ise seçimi temizle
    if (selectedChat?.id === leftGroupId) {
      setSelectedChat(null);
      setShowUserList(true);
    }
  };

  if (!user) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light p-3">
        <Auth onLogin={() => {}} />
      </div>
    );
  }

  if (user && (!userData || !userData.username)) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light p-3">
        <ProfileSetup user={user} onComplete={handleProfileSetupComplete} />
      </div>
    );
  }

  return (
    <div className="container-fluid h-100 d-flex flex-column bg-light">
      <div className="row flex-grow-1 g-0">
        <div
          className={`col-12 col-md-4 col-lg-3 bg-white border-end d-flex flex-column shadow-sm ${
            !showUserList ? "d-none d-md-flex" : ""
          }`}
        >
          <div className="p-3 border-bottom d-flex align-items-center">
            <h5 className="mb-0 text-primary flex-grow-1">
              Merhaba,{" "}
              <span className="fw-bold">{userData?.username || "Misafir"}</span>
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
            <UserList currentUser={userData} onSelectChat={handleSelectChat} />
          </div>
          <div className="p-3 border-top">
            <button
              className="btn btn-success w-100"
              onClick={() => setShowCreateGroupModal(true)}
            >
              Yeni Grup Oluştur
            </button>
          </div>
        </div>

        <div
          className={`col-12 col-md-8 col-lg-9 d-flex flex-column p-0 ${
            showUserList ? "d-none d-md-flex" : ""
          }`}
        >
          {selectedChat ? (
            <>
              <div className="d-md-none p-2 border-bottom bg-white d-flex align-items-center">
                <button
                  className="btn btn-outline-secondary btn-sm me-2"
                  onClick={() => setShowUserList(true)}
                >
                  &larr; Geri
                </button>
                <span className="fw-bold">
                  {selectedChat.username || selectedChat.name}
                </span>
              </div>
              <ChatBox
                currentUser={userData}
                selectedChat={selectedChat}
                onLeaveGroup={handleLeaveGroup} // Burada ekliyoruz
              />
            </>
          ) : (
            <div className="d-flex flex-grow-1 justify-content-center align-items-center text-muted">
              <p>Sohbet etmek için bir kullanıcı veya grup seçin.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateGroupModal && (
        <CreateGroup
          currentUser={userData}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}

export default App;
