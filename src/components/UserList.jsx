import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const generateChatId = (uid1, uid2) => {
  return uid1 > uid2 ? uid1 + uid2 : uid2 + uid1;
};

export default function UserList({ currentUser, onSelectChat }) {
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leavingGroupId, setLeavingGroupId] = useState(null); // Gruptan çıkılırken loading göstermek için

  const sortAndCombineChats = (allChats) => {
    const uniqueChatsMap = new Map();
    allChats.forEach((chat) => {
      uniqueChatsMap.set(chat.id || chat.uid, chat);
    });

    const combined = Array.from(uniqueChatsMap.values());

    return combined.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp?.toDate() || new Date(0);
      const timeB = b.lastMessage?.timestamp?.toDate() || new Date(0);
      return timeB.getTime() - timeA.getTime();
    });
  };

  const isLastMessageRead = (lastMessage, chatType, members) => {
    if (!lastMessage || !lastMessage.readBy || !currentUser.uid) {
      return false;
    }

    const isSentByCurrentUser = lastMessage.from === currentUser.uid;

    if (chatType === "user") {
      if (isSentByCurrentUser) {
        return lastMessage.readBy.length > 1;
      } else {
        return lastMessage.readBy.includes(currentUser.uid);
      }
    } else if (chatType === "group") {
      if (isSentByCurrentUser) {
        const totalMembers = members ? members.length : 1;
        return lastMessage.readBy.length === totalMembers;
      } else {
        return lastMessage.readBy.includes(currentUser.uid);
      }
    }
    return false;
  };

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    let unsubscribeUsers = () => {};
    let unsubscribeGroups = () => {};

    try {
      const usersRef = collection(db, "users");
      const qUsers = query(usersRef, where("uid", "!=", currentUser.uid));

      unsubscribeUsers = onSnapshot(
        qUsers,
        async (snapshot) => {
          const fetchedUsers = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const userData = {
                id: docSnap.id,
                ...docSnap.data(),
                type: "user",
              };

              const chatId = generateChatId(currentUser.uid, userData.uid);
              const chatDocRef = doc(db, "chats", chatId);
              try {
                const chatDocSnap = await getDoc(chatDocRef);
                userData.lastMessage = chatDocSnap.exists()
                  ? chatDocSnap.data().lastMessage
                  : null;
              } catch (err) {
                console.warn(
                  `Kullanıcı ${
                    userData.username || userData.uid
                  } için sohbet belgesi getirilemedi:`,
                  err.message
                );
                userData.lastMessage = null;
              }
              return userData;
            })
          );

          setChats((prevChats) => {
            const all = [
              ...prevChats.filter((c) => c.type === "group"),
              ...fetchedUsers,
            ];
            return sortAndCombineChats(all);
          });
        },
        (err) => {
          console.error("Kullanıcılar dinlenirken hata:", err);
          setError("Kullanıcı listesi yüklenirken bir hata oluştu.");
        }
      );
    } catch (err) {
      console.error("Kullanıcı sorgusu oluşturulurken hata:", err);
      setError("Kullanıcı listesi oluşturulurken bir hata oluştu.");
    }

    try {
      const groupsRef = collection(db, "groups");
      const qGroups = query(
        groupsRef,
        where("members", "array-contains", currentUser.uid)
      );

      unsubscribeGroups = onSnapshot(
        qGroups,
        async (snapshot) => {
          const fetchedGroups = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const groupData = {
                id: docSnap.id,
                ...docSnap.data(),
                type: "group",
              };

              const groupDocRef = doc(db, "groups", groupData.id);
              try {
                const groupDocSnap = await getDoc(groupDocRef);
                groupData.lastMessage = groupDocSnap.exists()
                  ? groupDocSnap.data().lastMessage
                  : null;
              } catch (err) {
                console.warn(
                  `Grup ${
                    groupData.name || groupData.id
                  } için sohbet belgesi getirilemedi:`,
                  err.message
                );
                groupData.lastMessage = null;
              }
              return groupData;
            })
          );

          setChats((prevChats) => {
            const all = [
              ...prevChats.filter((c) => c.type === "user"),
              ...fetchedGroups,
            ];
            return sortAndCombineChats(all);
          });
        },
        (err) => {
          console.error("Gruplar dinlenirken hata:", err);
          setError("Grup listesi yüklenirken bir hata oluştu.");
        }
      );
    } catch (err) {
      console.error("Grup sorgusu oluşturulurken hata:", err);
      setError("Grup listesi oluşturulurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }

    return () => {
      unsubscribeUsers();
      unsubscribeGroups();
    };
  }, [currentUser?.uid]);

  const filteredChats = chats.filter((chat) =>
    (chat.username || chat.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const leaveGroup = async (groupId) => {
    if (!groupId) return;
    setLeavingGroupId(groupId);

    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        members: arrayRemove(currentUser.uid),
      });
      console.log("Gruptan çıkıldı:", groupId);
      // Opsiyonel: çıkılan grup anında listeden kalkabilir, setChats güncellenebilir
      setChats((prev) => prev.filter((chat) => chat.id !== groupId));
    } catch (error) {
      console.error("Gruptan çıkarken hata:", error);
      alert("Gruptan çıkarken hata oluştu: " + error.message);
    } finally {
      setLeavingGroupId(null);
    }
  };

  return (
    <div className="p-3">
      {error && <div className="alert alert-danger mb-3">{error}</div>}
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Kullanıcı veya grup ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ul className="list-group list-group-flush">
        {loading && (
          <li className="list-group-item text-center text-muted">
            Sohbetler yükleniyor...
          </li>
        )}
        {!loading && filteredChats.length === 0 && (
          <li className="list-group-item text-center text-muted">
            Kullanıcı veya grup bulunamadı.
          </li>
        )}
        {filteredChats.map((chat) => (
          <li
            key={chat.id || chat.uid}
            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2"
            style={{ cursor: "pointer" }}
          >
            <div
              onClick={() => onSelectChat(chat)}
              style={{ flex: 1 }}
              title={chat.username || chat.name}
            >
              {chat.type === "user" ? (
                <span
                  className={`badge rounded-circle ${
                    chat.isOnline ? "bg-success" : "bg-secondary"
                  } me-2`}
                  style={{
                    width: "10px",
                    height: "10px",
                    display: "inline-block",
                  }}
                  title={chat.isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                ></span>
              ) : (
                <i className="bi bi-people-fill me-2 text-info"></i>
              )}
              <span className="fw-bold">{chat.username || chat.name}</span>
              {chat.lastMessage?.text && (
                <small
                  className={`text-truncate d-block ${
                    isLastMessageRead(chat.lastMessage, chat.type, chat.members)
                      ? "text-muted"
                      : "text-primary fw-bold"
                  }`}
                  style={{ maxWidth: "60%" }}
                >
                  {chat.lastMessage.text}
                  {isLastMessageRead(
                    chat.lastMessage,
                    chat.type,
                    chat.members
                  ) && <span className="ms-1">✓</span>}
                </small>
              )}
            </div>
            {chat.type === "group" && (
              <button
                className="btn btn-sm btn-outline-danger ms-2"
                onClick={() => leaveGroup(chat.id)}
                disabled={leavingGroupId === chat.id}
                title="Gruptan Çık"
              >
                {leavingGroupId === chat.id ? "Çıkıyor..." : "Çık"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
