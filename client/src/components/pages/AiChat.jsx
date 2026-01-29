import React, { useState, useEffect } from "react";
import User from "../chat/UserInput";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import ChatSidebar from "../Layout/ChatSidebar";
import GlobalNavBar from "../layout/GlobalNavBar";

const AiChat = ({ loggedIn }) => {
  const [removeTitle, setRemoveTitle] = useState(false);
  const [hideTitle, setHideTitle] = useState(false);
  const [savedChats, setSavedChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatToDelete, setChatToDelete] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);

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
      },
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
        },
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
          },
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
      (chat) => chat.id === chatId || chat.id === parseInt(chatId),
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
          },
        );
      } catch (error) {
        console.error("Failed to delete chat from database:", error);
      }
    }

    const updatedChatsList = savedChats.filter(
      (chat) => chat.id !== chatId && chat.id !== parseInt(chatId),
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hideTitle) {
        handleTitleClick();
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [hideTitle]);

  const toggleSidebar = () => setShowSidebar((prev) => !prev);

  return (
    <div className="d-flex">
      {/* 1. THE MOBILE SIDEBAR (Keep it separate) */}
      <div
        className="offcanvas offcanvas-start w-75 offcanvasBar"
        tabIndex="-1"
        id="chatSidebarMobile"
      >
        <div className="offcanvas-header">
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          ></button>
        </div>
        <div className="offcanvas-body p-0">
          <ChatSidebar
            savedChats={savedChats}
            activeChat={activeChat}
            onLoadChat={handleLoadChat}
            onNewChat={handleNewChat}
            chatToDelete={chatToDelete}
            setChatToDelete={setChatToDelete}
            onDeleteChat={deleteAChat}
            onClearAll={handleClearAll}
            onClose={() => {
              const offcanvas = document.getElementById("chatSidebarMobile");
              bootstrap.Offcanvas.getInstance(offcanvas)?.hide();
            }}
          />
        </div>
      </div>

      {/* 2. THE DESKTOP SIDEBAR (Static on the left) */}
      <div className="d-none d-lg-block sideBar">
        <ChatSidebar
          savedChats={savedChats}
          activeChat={activeChat}
          onLoadChat={handleLoadChat}
          onNewChat={handleNewChat}
          chatToDelete={chatToDelete}
          setChatToDelete={setChatToDelete}
          onDeleteChat={deleteAChat}
          onClearAll={handleClearAll}
        />
      </div>

      {/* 3. THE MAIN CONTENT AREA */}
      <div className="container chatAiMainDiv">
        <div className="flex-grow-1 d-flex flex-column">
          <GlobalNavBar
            showChatHamburger={true}
            onToggleChatSidebar={toggleSidebar}
          />

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
      </div>
    </div>
  );
};

export default AiChat;
