import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, storage } from "../firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const generateChatId = (uid1, uid2) => {
  return uid1 > uid2 ? uid1 + uid2 : uid2 + uid1;
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export default function ChatBox({ currentUser, selectedChat, onLeaveGroup }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [error, setError] = useState("");
  const [leavingGroup, setLeavingGroup] = useState(false);

  const messagesEndRef = useRef(null);

  const chatContextId = selectedChat
    ? selectedChat.type === "user"
      ? generateChatId(currentUser.uid, selectedChat.uid)
      : selectedChat.id
    : null;

  const chatCollectionPath = selectedChat?.type === "user" ? "chats" : "groups";

  useEffect(() => {
    if (!chatContextId) {
      setMessages([]);
      setTypingUsers({});
      return;
    }

    setError("");

    const messagesRef = collection(
      db,
      chatCollectionPath,
      chatContextId,
      "messages"
    );
    const messagesQuery = query(messagesRef, orderBy("timestamp"));

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(msgs);
      },
      (err) => {
        console.error("Mesaj dinlenirken hata:", err);
        setError("Mesajlar yüklenirken bir hata oluştu.");
      }
    );

    const chatDocRef = doc(db, chatCollectionPath, chatContextId);
    const unsubscribeTyping = onSnapshot(
      chatDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          setTypingUsers(data.typing || {});
        } else {
          setTypingUsers({});
        }
      },
      (err) => {
        console.error("Yazma durumu dinlenirken hata:", err);
        setError("Yazma durumu bilgileri yüklenemedi.");
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [chatContextId, chatCollectionPath]);

  useEffect(() => {
    const unreadMessages = messages.filter(
      (msg) =>
        msg.sender !== currentUser.uid &&
        (!msg.readBy || !msg.readBy.includes(currentUser.uid))
    );

    if (!chatContextId || unreadMessages.length === 0) return;

    const markMessagesAsRead = async () => {
      await Promise.all(
        unreadMessages.map(async (msg) => {
          const msgRef = doc(
            db,
            chatCollectionPath,
            chatContextId,
            "messages",
            msg.id
          );
          try {
            await updateDoc(msgRef, {
              readBy: arrayUnion(currentUser.uid),
            });
          } catch (error) {
            console.error(
              `Mesajı okundu olarak işaretleme hatası (${msg.id}):`,
              error
            );
          }
        })
      );
    };

    markMessagesAsRead();
  }, [messages, chatContextId, currentUser.uid, chatCollectionPath]);

  const updateTypingStatus = useCallback(
    async (isTyping) => {
      if (!chatContextId || !currentUser) return;

      const chatDocRef = doc(db, chatCollectionPath, chatContextId);

      try {
        const docSnap = await getDoc(chatDocRef);

        if (!docSnap.exists()) {
          const initialDocData = {
            typing: {
              [currentUser.uid]: isTyping,
            },
            createdAt: serverTimestamp(),
          };

          if (selectedChat.type === "user") {
            initialDocData.user1 = currentUser.uid;
            initialDocData.user2 = selectedChat.uid;
          } else if (selectedChat.type === "group") {
            initialDocData.name = selectedChat.name || "Bilinmeyen Grup";
            initialDocData.members = selectedChat.members || [currentUser.uid];
            initialDocData.createdBy =
              selectedChat.createdBy || currentUser.uid;
          }

          await setDoc(chatDocRef, initialDocData);
          console.log("Sohbet/grup belgesi başarıyla oluşturuldu.");
        } else {
          await updateDoc(chatDocRef, {
            [`typing.${currentUser.uid}`]: isTyping,
          });
        }
      } catch (err) {
        console.error("Yazma durumu güncelleme hatası:", err);
      }
    },
    [chatContextId, chatCollectionPath, currentUser, selectedChat]
  );

  const typingTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    updateTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 1000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatContextId || !currentUser) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    await updateTypingStatus(false);

    try {
      const messageData = {
        text: newMessage.trim(),
        sender: currentUser.uid,
        senderName: currentUser.username || currentUser.email,
        timestamp: serverTimestamp(),
        readBy: [currentUser.uid],
        reactions: {},
      };

      if (selectedChat.type === "user") {
        messageData.receiver = selectedChat.uid;
      }

      await addDoc(
        collection(db, chatCollectionPath, chatContextId, "messages"),
        messageData
      );

      const lastMessageData = {
        text: newMessage.trim(),
        from: currentUser.uid,
        timestamp: serverTimestamp(),
        readBy: [currentUser.uid],
      };
      if (selectedChat.type === "user") {
        lastMessageData.to = selectedChat.uid;
      }

      await updateDoc(doc(db, chatCollectionPath, chatContextId), {
        lastMessage: lastMessageData,
      });

      setNewMessage("");
    } catch (err) {
      console.error("Mesaj gönderilirken hata:", err);
      setError("Mesaj gönderilemedi: " + err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !chatContextId || !currentUser) return;

    setError("");

    const fileRef = storageRef(
      storage,
      `${chatCollectionPath}/${chatContextId}/${Date.now()}_${file.name}`
    );

    try {
      await uploadBytes(fileRef, file);
      const fileURL = await getDownloadURL(fileRef);

      const isImage = file.type.startsWith("image");
      const isVideo = file.type.startsWith("video");

      const messageData = {
        mediaURL: fileURL,
        mediaType: isImage ? "image" : isVideo ? "video" : "file",
        sender: currentUser.uid,
        senderName: currentUser.username || currentUser.email,
        timestamp: serverTimestamp(),
        readBy: [currentUser.uid],
        reactions: {},
      };

      if (selectedChat.type === "user") {
        messageData.receiver = selectedChat.uid;
      }

      await addDoc(
        collection(db, chatCollectionPath, chatContextId, "messages"),
        messageData
      );

      await updateDoc(doc(db, chatCollectionPath, chatContextId), {
        lastMessage: {
          text: isImage ? "📷 Fotoğraf" : isVideo ? "🎥 Video" : "📎 Dosya",
          from: currentUser.uid,
          timestamp: serverTimestamp(),
          readBy: [currentUser.uid],
          ...(selectedChat.type === "user" && { to: selectedChat.uid }),
        },
      });

      e.target.value = null;
    } catch (err) {
      console.error("Medya yükleme hatası:", err);
      setError("Dosya yüklenirken bir hata oluştu: " + err.message);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const otherTypingUsers = Object.entries(typingUsers).filter(
    ([uid, typing]) => uid !== currentUser.uid && typing === true
  );

  // --- Yeni: Gruptan çıkma fonksiyonu ---
  const leaveGroup = async () => {
    if (!selectedChat || selectedChat.type !== "group") return;

    if (
      !window.confirm(
        `"${selectedChat.name}" grubundan çıkmak istediğine emin misin?`
      )
    )
      return;

    setLeavingGroup(true);
    try {
      const groupRef = doc(db, "groups", selectedChat.id);
      await updateDoc(groupRef, {
        members: arrayRemove(currentUser.uid),
      });
      setLeavingGroup(false);
      if (onLeaveGroup) onLeaveGroup(selectedChat.id);
    } catch (error) {
      console.error("Gruptan çıkarken hata:", error);
      alert("Gruptan çıkarken bir hata oluştu: " + error.message);
      setLeavingGroup(false);
    }
  };

  if (!selectedChat || !currentUser) {
    return (
      <div className="d-flex flex-grow-1 justify-content-center align-items-center text-muted">
        <p>Sohbet etmek için bir kullanıcı veya grup seçin.</p>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100 bg-white shadow-sm">
      <div className="p-3 border-bottom bg-light d-flex align-items-center">
        <h5 className="mb-0 text-primary flex-grow-1">
          {selectedChat.username || selectedChat.name}
          {selectedChat.type === "group" && (
            <span className="badge bg-info text-dark ms-2">Grup</span>
          )}
        </h5>

        {selectedChat.type === "group" && (
          <button
            className="btn btn-outline-danger btn-sm ms-3"
            onClick={leaveGroup}
            disabled={leavingGroup}
            title="Gruptan Çık"
          >
            {leavingGroup ? "Çıkıyor..." : "Gruptan Çık"}
          </button>
        )}
      </div>

      <div className="flex-grow-1 p-3 overflow-auto chat-messages-container">
        {error && <div className="alert alert-danger">{error}</div>}
        {messages.length === 0 && (
          <p className="text-center text-muted">
            Sohbet başlatmak için mesaj yazınız.
          </p>
        )}
        {messages.map((msg) => {
          let date = null;
          if (msg.timestamp?.toDate) {
            date = msg.timestamp.toDate();
          } else if (msg.timestamp instanceof Date) {
            date = msg.timestamp;
          }

          const isSender = msg.sender === currentUser.uid;
          const messageBubbleClass = isSender
            ? "bg-primary text-white ms-auto"
            : "bg-light border";

          return (
            <div
              key={msg.id}
              className={`d-flex mb-3 ${
                isSender ? "justify-content-end" : "justify-content-start"
              }`}
            >
              <div
                className={`p-2 rounded-lg position-relative ${messageBubbleClass}`}
                style={{ maxWidth: "75%" }}
              >
                {selectedChat.type === "group" && !isSender && (
                  <small className="text-muted d-block mb-1">
                    {msg.senderName || "Bilinmeyen Kullanıcı"}
                  </small>
                )}

                {msg.text && <div>{msg.text}</div>}
                {msg.mediaURL && msg.mediaType === "image" && (
                  <img
                    src={msg.mediaURL}
                    alt="Görsel"
                    className="img-fluid rounded mt-2"
                    style={{ maxWidth: "200px" }}
                  />
                )}
                {msg.mediaURL && msg.mediaType === "video" && (
                  <video
                    controls
                    className="img-fluid rounded mt-2"
                    style={{ maxWidth: "200px" }}
                  >
                    <source src={msg.mediaURL} type="video/mp4" />
                    Tarayıcınız video etiketini desteklemiyor.
                  </video>
                )}
                {msg.mediaURL && msg.mediaType === "file" && (
                  <a
                    href={msg.mediaURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="d-block mt-2 text-primary"
                  >
                    <i className="bi bi-file-earmark"></i> Dosya İndir
                  </a>
                )}

                <div className="d-flex flex-wrap mt-2" style={{ gap: "6px" }}>
                  {EMOJIS.map((emoji) => {
                    const usersReacted = msg.reactions?.[emoji] || [];
                    const hasReacted = usersReacted.includes(currentUser.uid);
                    return (
                      <span
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={`badge rounded-pill ${
                          hasReacted ? "bg-info text-dark" : "bg-secondary"
                        }`}
                        style={{
                          cursor: "pointer",
                          opacity:
                            hasReacted || usersReacted.length > 0 ? 1 : 0.7,
                        }}
                        title={`${emoji} ${usersReacted
                          .map((uid) => (uid === currentUser.uid ? "Sen" : uid))
                          .join(", ")}`}
                      >
                        {emoji}{" "}
                        {usersReacted.length > 0 ? usersReacted.length : ""}
                      </span>
                    );
                  })}
                </div>

                {date && (
                  <div
                    className="text-right mt-1"
                    style={{ fontSize: "0.75em", opacity: 0.8 }}
                  >
                    {formatDistanceToNow(date, { addSuffix: true, locale: tr })}
                  </div>
                )}

                {isSender && (
                  <div
                    className="text-right"
                    style={{
                      fontSize: "0.7em",
                      color:
                        (selectedChat.type === "user" &&
                          msg.readBy?.length > 1) ||
                        (selectedChat.type === "group" &&
                          selectedChat.members &&
                          msg.readBy?.length === selectedChat.members.length)
                          ? "#00e676"
                          : "#bdbdbd",
                    }}
                  >
                    {(selectedChat.type === "user" && msg.readBy?.length > 1) ||
                    (selectedChat.type === "group" &&
                      selectedChat.members &&
                      msg.readBy?.length === selectedChat.members.length)
                      ? "Okundu ✓"
                      : "Gönderildi"}
                    {selectedChat.type === "group" &&
                      selectedChat.members &&
                      msg.readBy?.length > 1 && (
                        <span className="ms-1">
                          ({msg.readBy.length}/{selectedChat.members.length})
                        </span>
                      )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {otherTypingUsers.length > 0 && (
        <div className="p-2 text-muted font-italic border-top">
          {selectedChat.type === "user"
            ? `${selectedChat.username || selectedChat.name} yazıyor...`
            : `${otherTypingUsers
                .map(([, typingStatus]) => {
                  return "Biri";
                })
                .join(", ")} yazıyor...`}
        </div>
      )}

      <div className="p-3 border-top bg-light">
        <div className="input-group">
          <input
            type="text"
            className="form-control rounded-pill me-2"
            placeholder="Mesaj yaz..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            disabled={!chatContextId}
          />
          <label
            htmlFor="file-upload"
            className="btn btn-outline-secondary rounded-pill me-2 mb-0 d-flex align-items-center justify-content-center"
          >
            <i className="bi bi-paperclip"></i>
            <input
              id="file-upload"
              type="file"
              accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
              onChange={handleFileUpload}
              className="d-none"
              disabled={!chatContextId}
            />
          </label>
          <button
            onClick={sendMessage}
            className="btn btn-primary rounded-pill"
            disabled={!newMessage.trim() || !chatContextId}
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );

  // --- toggleReaction fonksiyonu burada ---
  async function toggleReaction(msgId, emoji) {
    if (!chatContextId || !currentUser) return;
    setError("");

    const msgRef = doc(
      db,
      chatCollectionPath,
      chatContextId,
      "messages",
      msgId
    );

    try {
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) {
        console.warn("Tepki verilmek istenen mesaj bulunamadı:", msgId);
        return;
      }
      const msgData = msgSnap.data();
      const usersReacted = msgData.reactions?.[emoji] || [];
      const hasReacted = usersReacted.includes(currentUser.uid);

      if (hasReacted) {
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: arrayRemove(currentUser.uid),
        });
      } else {
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: arrayUnion(currentUser.uid),
        });
      }
    } catch (err) {
      console.error("Tepki güncelleme hatası:", err);
      setError("Tepki eklerken/kaldırırken bir hata oluştu.");
    }
  }
}
