import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import "bootstrap/dist/css/bootstrap.min.css";

export default function UserList({ currentUser, onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const generateChatId = (uid1, uid2) => {
    return uid1 > uid2 ? uid1 + uid2 : uid2 + uid1;
  };

  const isLastMessageRead = (lastMessage) => {
    if (!lastMessage || !lastMessage.readBy) return false;
    return lastMessage.readBy.some((uid) => uid !== currentUser.uid);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const filteredUsers = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((user) => user.uid !== currentUser.uid);

      const usersWithLastMessages = await Promise.all(
        filteredUsers.map(async (user) => {
          const chatId = generateChatId(currentUser.uid, user.uid);
          const chatDocRef = doc(db, "chats", chatId);
          const chatDocSnap = await getDoc(chatDocRef);

          user.lastMessage = chatDocSnap.exists()
            ? chatDocSnap.data().lastMessage
            : null;

          return user;
        })
      );

      setUsers(usersWithLastMessages);
    };

    if (currentUser?.uid) {
      fetchUsers();
    }
  }, [currentUser?.uid]);

  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-3">
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Kullanıcı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ul className="list-group list-group-flush">
        {filtered.map((user) => (
          <li
            key={user.id}
            onClick={() => onSelectUser(user)}
            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2"
            style={{ cursor: "pointer" }}
          >
            <div>
              <span
                className={`badge badge-pill ${
                  user.isOnline ? "badge-success" : "badge-secondary"
                } mr-2`}
                style={{
                  width: "10px",
                  height: "10px",
                  display: "inline-block",
                  borderRadius: "50%",
                }}
              ></span>
              <span className="font-weight-bold">{user.username}</span>
            </div>
            {user.lastMessage?.text && (
              <small
                className={`text-truncate ${
                  isLastMessageRead(user.lastMessage)
                    ? "text-muted"
                    : "text-primary font-weight-bold"
                }`}
                style={{ maxWidth: "60%" }}
              >
                {user.lastMessage.text}
                {isLastMessageRead(user.lastMessage) && (
                  <span className="ml-1">✓</span>
                )}
              </small>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="list-group-item text-center text-muted">
            Kullanıcı bulunamadı.
          </li>
        )}
      </ul>
    </div>
  );
}
