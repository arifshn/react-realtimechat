import { useEffect, useState, useRef } from "react";
import { db } from "../firebaseConfig";
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
} from "firebase/firestore";

import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import "bootstrap/dist/css/bootstrap.min.css";

const generateChatId = (uid1, uid2) => {
  return uid1 > uid2 ? uid1 + uid2 : uid2 + uid1;
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export default function ChatBox({ currentUser, selectedUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);

  const chatId =
    currentUser?.uid && selectedUser?.uid
      ? generateChatId(currentUser.uid, selectedUser.uid)
      : null;

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setTypingUsers({});
      return;
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp"));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    const chatDocRef = doc(db, "chats", chatId);
    const unsubscribeTyping = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTypingUsers(data.typing || {});
      } else {
        setTypingUsers({});
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    messages.forEach(async (msg) => {
      if (
        msg.sender !== currentUser.uid &&
        !msg.readBy?.includes(currentUser.uid)
      ) {
        const msgRef = doc(db, "chats", chatId, "messages", msg.id);
        await updateDoc(msgRef, {
          readBy: arrayUnion(currentUser.uid),
        });
      }
    });
  }, [messages, chatId, currentUser.uid]);

  const updateTypingStatus = async (isTyping) => {
    if (!chatId) return;
    const chatDocRef = doc(db, "chats", chatId);
    try {
      await updateDoc(chatDocRef, {
        [`typing.${currentUser.uid}`]: isTyping,
      });
    } catch (error) {
      if (error.code === "not-found") {
        await setDoc(
          chatDocRef,
          {
            typing: {
              [currentUser.uid]: isTyping,
            },
          },
          { merge: true }
        );
      } else {
        console.error("Typing status update error:", error);
      }
    }
  };

  let typingTimeout = useRef(null);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    updateTypingStatus(true);

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 1000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: newMessage.trim(),
        sender: currentUser.uid,
        receiver: selectedUser.uid,
        timestamp: serverTimestamp(),
        readBy: [currentUser.uid],
        reactions: {},
      });

      await setDoc(
        doc(db, "chats", chatId),
        {
          lastMessage: {
            text: newMessage.trim(),
            from: currentUser.uid,
            to: selectedUser.uid,
            timestamp: serverTimestamp(),
          },
          typing: {
            [currentUser.uid]: false,
          },
        },
        { merge: true }
      );

      setNewMessage("");
    } catch (error) {
      console.error("Mesaj gönderilirken hata:", error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isOtherUserTyping = Object.entries(typingUsers).some(
    ([uid, typing]) => uid !== currentUser.uid && typing === true
  );

  const toggleReaction = async (msgId, emoji) => {
    if (!chatId) return;
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    const usersReacted = msg.reactions?.[emoji] || [];
    const hasReacted = usersReacted.includes(currentUser.uid);

    try {
      if (hasReacted) {
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: arrayRemove(currentUser.uid),
        });
      } else {
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: arrayUnion(currentUser.uid),
        });
      }
    } catch (error) {
      console.error("Reaction update error:", error);
    }
  };

  return (
    <div className="d-flex flex-column h-100 bg-white shadow-sm">
      <div className="p-3 border-bottom bg-light">
        <h5 className="mb-0 text-primary">
          {selectedUser?.username || "Sohbet"}
        </h5>
      </div>

      <div className="flex-grow-1 p-3 overflow-auto chat-messages-container">
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
            ? "bg-primary text-white ml-auto"
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
                {msg.text}
                <div className="d-flex flex-wrap mt-2" style={{ gap: "6px" }}>
                  {EMOJIS.map((emoji) => {
                    const usersReacted = msg.reactions?.[emoji] || [];
                    const hasReacted = usersReacted.includes(currentUser.uid);
                    return (
                      <span
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={`badge badge-pill ${
                          hasReacted ? "badge-primary" : "badge-secondary"
                        }`}
                        style={{
                          cursor: "pointer",
                          opacity: hasReacted ? 1 : 0.7,
                        }}
                        title={
                          hasReacted
                            ? `Tepkini kaldır: ${emoji}`
                            : `Tepki ver: ${emoji}`
                        }
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
                      color: msg.readBy?.length > 1 ? "#00e676" : "#bdbdbd",
                    }}
                  >
                    {msg.readBy?.length > 1 ? "Okundu ✓" : "Gönderildi"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {isOtherUserTyping && (
        <div className="p-2 text-muted font-italic border-top">
          {selectedUser?.username} yazıyor...
        </div>
      )}

      <div className="p-3 border-top bg-light">
        <div className="input-group">
          <input
            type="text"
            className="form-control rounded-pill mr-2"
            placeholder="Mesaj yaz..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            className="btn btn-primary rounded-pill"
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}
