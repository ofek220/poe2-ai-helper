import React, { useState, useEffect } from "react";
import User from "./User";
import LoginForm from "./LoginForm";
import WindowSize from "./WindowSize";
import { v4 as uuidv4 } from "uuid";

const LOCAL_KEY = "savedChats_v1";

let sessionId = localStorage.getItem("sessionId");
if (!sessionId) {
  sessionId = uuidv4();
  localStorage.setItem("sessionId", sessionId);
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  const [removeTitle, setRemoveTitle] = useState(false);
  const [hideTitle, setHideTitle] = useState(false);
  const [savedChats, setSavedChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatToDelete, setChatToDelete] = useState("");
  // https://poe2-ai-helper.onrender.com/api/check -- https://poe2-ai-helper.onrender.com/login
  //log in http://localhost:3000/api/check  -- http://localhost:3000/login
  useEffect(() => {
    fetch("https://poe2-ai-helper.onrender.com/api/check", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setLoggedIn(data.loggedIn));
  }, []);

  // load saved chats from server
  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) return;

    fetch(`https://poe2-ai-helper.onrender.com/messages/${sessionId}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((chatThreads) => {
        const formattedChats = chatThreads.map((chat, idx) => ({
          id: chat.chat_id,
          name: `Chat ${idx + 1}`,
          messages: [],
          lastActive: chat.last_active,
        }));
        setSavedChats(formattedChats);
      })
      .catch((err) => console.error("Failed to load chats:", err));
  }, []);

  const handleAutoSave = (messages, chatId) => {
    if (!messages || messages.length === 0) return;

    if (activeChat) {
      const updatedChat = { ...activeChat, messages };
      const updatedChats = savedChats.map((chat) =>
        chat.id === activeChat.id ? updatedChat : chat
      );
      setSavedChats(updatedChats);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(updatedChats));
      setActiveChat(updatedChat);

      fetch("https://poe2-ai-helper.onrender.com/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId,
          chatId,
          role: "user",
          messages,
        }),
      });
    } else {
      if (messages.length >= 2) {
        const newChat = {
          id: Date.now(),
          name: `Chat ${savedChats.length + 1}`,
          messages,
          timestamp: new Date().toISOString(),
        };
        const updated = [...savedChats, newChat];
        setSavedChats(updated);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
        setActiveChat(newChat);
      }
    }
  };

  const handleLoadChat = async (chatId) => {
    const sessionId = localStorage.getItem("sessionId");
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
        name: `Chat ${chatId}`,
        messages,
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
        console.log("🗑️ Deleted all images from server");
      } catch (error) {
        console.error("Failed to delete images:", error);
      }
    }

    localStorage.removeItem(LOCAL_KEY);
    setSavedChats([]);
    setActiveChat(null);
    setChatToDelete("");
  };

  const deleteAChat = async (chatId) => {
    if (!chatId) {
      alert("Please select a chat to delete");
      return;
    }

    const chatToDelete = savedChats.find(
      (chat) => chat.id === parseInt(chatId)
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
        console.log(`🗑️ Deleted ${imageUrls.length} images from server`);
      } catch (error) {
        console.error("Failed to delete images:", error);
      }
    }
    const updatedChatsList = savedChats.filter(
      (chat) => chat.id !== parseInt(chatId)
    );
    setSavedChats(updatedChatsList);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updatedChatsList));
    if (activeChat?.id === parseInt(chatId)) {
      setActiveChat(null);
    }
    setChatToDelete("");
  };

  const handleNewChat = () => {
    const newChatId = uuidv4();
    const newChat = {
      id: Date.now(),
      chatId: newChatId,
      name: `Chat ${savedChats.length + 1}`,
      messages: [],
      timestamp: new Date().toISOString(),
    };
    setActiveChat(newChat);
    setSavedChats([...savedChats, newChat]);
  };

  if (!loggedIn) {
    return (
      <LoginForm
        onLoginSuccess={() => {
          setLoggedIn(true);
          setLoading(false);
        }}
      />
    );
  }

  const handleTitleClick = () => {
    setHideTitle(true);

    setTimeout(() => {
      setRemoveTitle(true);
    }, 2000);
  };

  return (
    <div className="container main-div">
      <nav
        className={`navbar navbar-nav-scroll navbar-light bg-light mb-2 navbar-dark 
      ${savedChats.length > 10 ? "" : "navbar-expand-sm"}`}
      >
        <div className="container-fluid">
          <a className="navbar-brand" href="#">
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
        onSaveChat={handleAutoSave}
        onNewChat={handleNewChat}
      />
    </div>
  );
}

export default App;
