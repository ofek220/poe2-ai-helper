import React, { useState, useEffect, useRef } from "react";
import ImageUpload from "./ImageUpload";

const User = ({ initialMessages = [], onSaveChat, onNewChat }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const bottomRef = useRef(null);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (onSaveChat) {
      onSaveChat(messages);
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() && images.length === 0) return;

    const userMessage = { role: "user", text: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setLoading(true);

    const formData = new FormData();
    formData.append("prompt", prompt);
    images.forEach((file) => formData.append("images", file));

    try {
      const res = await fetch(
        "https://poe2-ai-helper.onrender.com/api/generate",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Full response data:", data);
      console.log("Response text:", data.response);

      if (!data.response) {
        throw new Error("No response content received");
      }

      const aiMessage = { role: "assistant", text: data.response };
      console.log("💬 Adding AI message to state:", aiMessage);
      setMessages((prev) => [...prev, aiMessage]);
      setImages([]);
      setPreviews([]);
    } catch (err) {
      console.error("❌ Frontend error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Server error" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setPrompt("");
    setImages([]);
    setPreviews([]);
    if (onNewChat) onNewChat();
  };

  const formatAssistantText = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/###\s*(.+)/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  };

  return (
    <div className="input-group flex-grow-1 overflow-auto p-3">
      <div
        className="container flex-grow-1 overflow-auto p-3"
        style={{ height: "60vh" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`d-flex mb-3 ${
              msg.role === "user"
                ? "justify-content-end"
                : "justify-content-start"
            }`}
          >
            <div
              className={`p-2 rounded-4 ${
                msg.role === "user" ? "userStyle" : "assistant"
              }`}
              style={{ maxWidth: "75%", whiteSpace: "pre-line" }}
            >
              {msg.role === "assistant" ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatAssistantText(msg.text),
                  }}
                />
              ) : (
                <div>{msg.text}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-secondary small mb-3">🧠 Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-group mb-3">
        <button onClick={handleNewChat} type="button" className="btn submitBtn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="bi bi-plus-lg"
            viewBox="0 0 16 16"
          >
            <path
              fill-rule="evenodd"
              d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"
            />
          </svg>
        </button>
        <input
          type="text"
          className="form-control"
          placeholder="What is on your mind?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <ImageUpload
          images={images}
          setImages={setImages}
          previews={previews}
          setPreviews={setPreviews}
        />
        <button type="submit" className="btn submitBtn" disabled={loading}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="bi bi-arrow-up"
            viewBox="0 0 16 16"
          >
            <path
              fill-rule="evenodd"
              d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5"
            />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default User;
