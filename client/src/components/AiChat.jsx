import React, { useState, useEffect } from "react";
import User from "./User";
import WindowSize from "./WindowSize";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

const AiChat = ({ loggedIn }) => {
  const [removeTitle, setRemoveTitle] = useState(false);
  const [hideTitle, setHideTitle] = useState(false);
  const [savedChats, setSavedChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatToDelete, setChatToDelete] = useState("");

  const navigate = useNavigate();
  const { classId: classId } = useParams();
  const sessionId = localStorage.getItem("sessionId");

  // load saved chats from server
  useEffect(() => {
    if (!loggedIn) return;

    if (!sessionId) return;

    fetch(
      `https://poe2-ai-helper.onrender.com/messages/${sessionId}?classId=${classId}`,
      {
        credentials: "include",
      }
    )
      .then((res) => res.json())
      .then((chatThreads) => {
        const formattedChats = chatThreads.map((chat, idx) => ({
          id: chat.chat_id,
          chatId: chat.chat_id,
          name: `Chat ${idx + 1}`,
          messages: chat.messages.map((m) => ({
            role: m.role,
            text: m.text ?? m.message,
            images: m.images || [],
          })),
          lastActive: chat.last_active,
          classId: classId,
        }));
        setSavedChats(formattedChats);

        if (formattedChats.length > 0) {
          setActiveChat(formattedChats[formattedChats.length - 1]);
        } else {
          handleNewChat();
        }
      })
      .catch((err) => console.error("Failed to load chats:", err));
  }, [loggedIn, classId]);

  const handleLoadChat = async (chatId) => {
    if (!sessionId) return;

    try {
      const res = await fetch(
        `https://poe2-ai-helper.onrender.com/messages/${sessionId}/${chatId}`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error(`Failed to load chat ${chatId}`);

      const messages = await res.json();
      const loadedChat = {
        id: chatId,
        chatId: chatId,
        name: savedChats.find((c) => c.id === chatId)?.name || `Chat ${chatId}`,
        messages: messages,
      };
      setActiveChat(loadedChat);
    } catch (error) {
      console.error("Error loading chat:", error);
    }
  };

  // https://poe2-ai-helper.onrender.com/api/upload
  // http://localhost:3000/api/upload
  const handleClearAll = async () => {
    if (!confirm("Clear all saved chats?")) return;

    const allImageUrls = savedChats
      .flatMap((chat) => chat.messages || [])
      .filter((msg) => msg.images && msg.images.length > 0)
      .flatMap((msg) => msg.images);

    if (allImageUrls.length > 0) {
      try {
        await fetch("https://poe2-ai-helper.onrender.com/api/upload", {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrls: allImageUrls }),
        });
      } catch (error) {
        console.error("Failed to delete images:", error);
      }
    }

    // Delete from database
    if (sessionId) {
      try {
        await fetch(
          `https://poe2-ai-helper.onrender.com/messages/${sessionId}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
      } catch (error) {
        console.error("Failed to delete chats from database:", error);
      }
    }

    localStorage.removeItem(LOCAL_KEY);
    setSavedChats([]);
    setActiveChat(null);
    setChatToDelete("");

    handleNewChat();
  };

  const deleteAChat = async (chatId) => {
    if (!chatId) {
      alert("Please select a chat to delete");
      return;
    }

    const chatToDelete = savedChats.find(
      (chat) => chat.id === chatId || chat.id === parseInt(chatId)
    );

    if (!chatToDelete) {
      alert("Chat not found");
      return;
    }

    if (!confirm(`Delete "${chatToDelete.name}"?`)) return;

    const imageUrls = chatToDelete.messages
      .filter((msg) => msg.images && msg.images.length > 0)
      .flatMap((msg) => msg.images);

    if (imageUrls.length > 0) {
      try {
        await fetch("https://poe2-ai-helper.onrender.com/api/upload", {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrls }),
        });
        // console.log(`🗑️ Deleted ${imageUrls.length} images from server`);
      } catch (error) {
        console.error("Failed to delete images:", error);
      }
    }

    // Delete from database
    if (sessionId) {
      try {
        await fetch(
          `https://poe2-ai-helper.onrender.com/messages/${sessionId}/${chatId}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
      } catch (error) {
        console.error("Failed to delete chat from database:", error);
      }
    }

    const updatedChatsList = savedChats.filter(
      (chat) => chat.id !== chatId && chat.id !== parseInt(chatId)
    );
    setSavedChats(updatedChatsList);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updatedChatsList));

    if (activeChat?.id === chatId || activeChat?.id === parseInt(chatId)) {
      if (updatedChatsList.length > 0) {
        setActiveChat(updatedChatsList[updatedChatsList.length - 1]);
      } else {
        handleNewChat();
      }
    }
    setChatToDelete("");
  };

  const handleNewChat = async () => {
    const newChatId = uuidv4();
    const newChat = {
      id: newChatId,
      chatId: newChatId,
      name: `Chat ${savedChats.length + 1}`,
      messages: [],
      timestamp: new Date().toISOString(),
      classId: classId,
    };

    setActiveChat(newChat);
    setSavedChats([...savedChats, newChat]);
  };

  const handleTitleClick = () => {
    setHideTitle(true);

    setTimeout(() => {
      setRemoveTitle(true);
    }, 2000);
  };

  const sendToMainPage = () => {
    navigate("/");
  };

  return (
    <div className="d-flex flex-column h-100">
      <nav
        className={`navbar navbar-nav-scroll navbar-light bg-light mb-2 navbar-dark 
      ${savedChats.length > 10 ? "" : "navbar-expand-sm"}`}
      >
        <div className="container-fluid">
          <a className="navbar-brand" onClick={sendToMainPage}>
            ♥
          </a>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarsExample03"
            aria-controls="navbarsExample03"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarsExample03">
            {/* CHAT LIST */}
            <WindowSize>
              {(windowWidth) => (
                <ul className="navbar-nav me-auto mb-2 mb-sm-0">
                  {savedChats.map((chat) => (
                    <li key={chat.id} className="nav-item">
                      <a
                        className={`nav-link ${
                          activeChat?.id === chat.id ? "active" : ""
                        }`}
                        onClick={() => {
                          handleLoadChat(chat.id);

                          if (savedChats.length > 10 || windowWidth < 768) {
                            const navbarCollapse =
                              document.querySelector(".navbar-collapse");
                            new bootstrap.Collapse(navbarCollapse).hide();
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {chat.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </WindowSize>

            {/* DELETE SECTION */}
            {savedChats.length > 0 && (
              <WindowSize savedChats={savedChats}>
                {(windowWidth) => (
                  <div
                    className={`d-flex align-items-center me-2 ${
                      savedChats.length > 10 || windowWidth < 768
                        ? "chatSelect"
                        : ""
                    }`}
                  >
                    <select
                      className="form-select form-select-sm me-2"
                      value={chatToDelete}
                      onChange={(e) => setChatToDelete(e.target.value)}
                      style={{ width: "150px" }}
                    >
                      <option value="">Select chat...</option>
                      {savedChats.map((chat) => (
                        <option key={chat.id} value={chat.id}>
                          {chat.name}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn btn-outline-warning btn-sm"
                      onClick={() => deleteAChat(chatToDelete)}
                      disabled={!chatToDelete}
                      title="Delete selected chat"
                    >
                      Delete Chat
                    </button>
                  </div>
                )}
              </WindowSize>
            )}
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
              Clear All chats
            </button>
          </div>
        </div>
      </nav>

      <div onClick={handleTitleClick}>
        {!removeTitle && (
          <h1 className={`title ${hideTitle ? "hideTitle" : ""}`}>
            Path of Exile 2 AI Helper <span>click me</span>
          </h1>
        )}
      </div>
      <hr style={{ margin: "5px" }} />

      <User
        key={activeChat?.id || "new"}
        initialMessages={activeChat?.messages || []}
        onNewChat={handleNewChat}
        chatId={activeChat?.chatId}
        classId={classId}
      />
    </div>
  );
};

export default AiChat;
