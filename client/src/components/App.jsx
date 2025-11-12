import React, { useState, useEffect } from "react";
import User from "./User";

const LOCAL_KEY = "savedChats_v1";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");

  const [savedChats, setSavedChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  //log in
  useEffect(() => {
    fetch("http://localhost:3000/api/check", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLoggedIn(data.loggedIn));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (res.ok) setLoggedIn(true);
    else alert("Invalid password");
  };
  //

  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        setSavedChats(JSON.parse(raw));
      } catch (error) {
        console.error("Error parsing saved chats:", error);
        localStorage.removeItem(LOCAL_KEY);
      }
    }
  }, []);

  const handleAutoSave = (messages) => {
    if (!messages || messages.length === 0) return;

    if (activeChat) {
      const updatedChats = savedChats.map((chat) =>
        chat.id === activeChat.id ? { ...chat, messages } : chat
      );
      setSavedChats(updatedChats);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(updatedChats));
      setActiveChat((prev) => ({ ...prev, messages }));
    } else {
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
  };
  const handleLoadChat = (chatId) => {
    const chat = savedChats.find((chat) => chat.id === chatId);
    if (chat) {
      setActiveChat(chat);
    }
  };

  const handleClearAll = () => {
    if (confirm("Clear all saved chats?")) {
      localStorage.removeItem(LOCAL_KEY);
      setSavedChats([]);
      setActiveChat(null);
    }
  };

  const handleNewChat = () => {
    setActiveChat(null);
  };

  if (!loggedIn) {
    return (
      <div style={{ padding: "2rem", color: "white" }}>
        <h2>Please log in</h2>

        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container main-div">
      <nav className="navbar navbar-expand-sm navbar-light bg-light mb-3">
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
            <ul className="navbar-nav me-auto mb-2 mb-sm-0">
              {savedChats.map((chat) => (
                <li key={chat.id} className="nav-item">
                  <a
                    className={`nav-link ${
                      activeChat?.id === chat.id ? "active" : ""
                    }`}
                    onClick={() => handleLoadChat(chat.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {chat.name}
                  </a>
                </li>
              ))}
            </ul>

            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
              Clear All
            </button>
          </div>
        </div>
      </nav>

      <h1 className="title">Path of Exile 2 AI Helper</h1>
      <hr />

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
