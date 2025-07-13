import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Modal,
  Button,
  Form,
  FormControl,
  ListGroup,
  Alert,
} from "react-bootstrap";

// Benzersiz joinCode üreten fonksiyon
const generateJoinCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function CreateGroup({ currentUser, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedFullMembers, setSelectedFullMembers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentUser && currentUser.uid) {
      setSelectedMembers([currentUser.uid]);
      setSelectedFullMembers([currentUser]);
    }

    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        setError("");
        const usersRef = collection(db, "users");

        const q = query(usersRef, where("uid", "!=", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllUsers(usersData);
      } catch (err) {
        console.error("Kullanıcılar getirilirken hata:", err);
        setError("Kullanıcıları yüklerken bir hata oluştu: " + err.message);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  const handleMemberToggle = (user) => {
    setSelectedMembers((prevSelectedUids) => {
      const isSelected = prevSelectedUids.includes(user.uid);
      if (isSelected) {
        setSelectedFullMembers((prevFullMembers) =>
          prevFullMembers.filter((member) => member.uid !== user.uid)
        );
        return prevSelectedUids.filter((uid) => uid !== user.uid);
      } else {
        setSelectedFullMembers((prevFullMembers) => [...prevFullMembers, user]);
        return [...prevSelectedUids, user.uid];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Grup adı boş olamaz.");
      return;
    }

    if (selectedMembers.length < 2) {
      setError("Gruba en az bir kişi daha eklemelisiniz.");
      return;
    }

    setCreatingGroup(true);
    setError("");

    try {
      const joinCode = generateJoinCode();

      const newGroupRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        members: selectedMembers,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        lastMessage: null,
        typing: {},
        joinCode, // joinCode eklendi
      });

      console.log("Grup oluşturuldu:", newGroupRef.id, "JoinCode:", joinCode);

      onGroupCreated({
        id: newGroupRef.id,
        name: groupName.trim(),
        members: selectedFullMembers,
        type: "group",
        joinCode,
      });

      onClose();
    } catch (err) {
      console.error("Grup oluşturulurken hata:", err);
      setError("Grup oluşturulurken bir hata oluştu: " + err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredUsers = allUsers.filter((user) =>
    (user.username || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal show={true} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Yeni Grup Oluştur</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Grup Adı</Form.Label>
          <FormControl
            type="text"
            placeholder="Grup Adı Giriniz"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            disabled={creatingGroup}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Üyeler ({selectedMembers.length} seçili):</Form.Label>
          <div className="d-flex flex-wrap mb-2">
            {selectedFullMembers.map((member) => (
              <span
                key={member.uid}
                className="badge bg-primary text-white me-1 mb-1 p-2"
              >
                {member.username}
              </span>
            ))}
          </div>
          <FormControl
            type="text"
            placeholder="Kullanıcı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={creatingGroup}
          />
        </Form.Group>

        <ListGroup style={{ maxHeight: "200px", overflowY: "auto" }}>
          {loadingUsers ? (
            <ListGroup.Item className="text-center text-muted">
              Kullanıcılar yükleniyor...
            </ListGroup.Item>
          ) : (
            filteredUsers.map((user) => (
              <ListGroup.Item
                key={user.uid}
                action
                onClick={() => handleMemberToggle(user)}
                className="d-flex justify-content-between align-items-center"
                active={selectedMembers.includes(user.uid)}
                disabled={creatingGroup}
              >
                {user.username}
                {selectedMembers.includes(user.uid) && (
                  <i className="bi bi-check-lg text-success"></i>
                )}
              </ListGroup.Item>
            ))
          )}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={creatingGroup}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={handleCreateGroup}
          disabled={
            creatingGroup || selectedMembers.length < 2 || !groupName.trim()
          }
        >
          {creatingGroup ? "Oluşturuluyor..." : "Grubu Oluştur"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
