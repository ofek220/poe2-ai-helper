import React, { useState, useEffect, useRef } from "react";
import ImageUpload from "./ImageUpload";
import TextareaAutosize from "react-textarea-autosize";
import { getAuthHeaders } from "../auth/Auth";

const User = ({ initialMessages = [], onNewChat, chatId, classId }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const bottomRef = useRef(null);

  // Initialize messages from props with safety check
  useEffect(() => {
    if (Array.isArray(initialMessages)) {
      setMessages(initialMessages);
    } else {
      console.warn("initialMessages is not an array:", initialMessages);
      setMessages([]);
    }
  }, [initialMessages]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() && images.length === 0) return;

    // https://poe2-ai-helper.onrender.com/api/generate
    // http://localhost:3000/api/generate
    try {
      let imagesUploaded = [];

      if (images.length > 0) {
        const uploadFormData = new FormData();
        images.forEach((file) => uploadFormData.append("images", file));

        const uploadRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/upload`,
          {
            method: "POST",
            credentials: "include",
            body: uploadFormData,
            headers: getAuthHeaders(),
          },
        );

        if (!uploadRes.ok) {
          throw new Error("failed to upload images");
        }

        const uploadData = await uploadRes.json();
        imagesUploaded = uploadData.imageUrls;
      }

      const userMessage = {
        role: "user",
        text: prompt,
        images: imagesUploaded,
      };
      setMessages((prev) => [...prev, userMessage]);
      setPrompt("");
      setLoading(true);
      setImages([]);
      setPreviews([]);

      const sessionId = localStorage.getItem("sessionId");
      if (chatId && sessionId) {
        await fetch(`${import.meta.env.VITE_API_URL}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
          body: JSON.stringify({
            sessionId,
            chatId,
            role: "user",
            message: prompt,
            images: imagesUploaded,
            classId,
          }),
        });
      }

      const conversationHistory = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content:
          msg.images && msg.images.length > 0
            ? [
                { type: "text", text: msg.text },
                ...msg.images.map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
              ]
            : msg.text,
      }));

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/generate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          classId,
          prompt: prompt,
          history: JSON.stringify(conversationHistory),
          imageUrls: imagesUploaded,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (!data.response) {
        throw new Error("No response content received");
      }

      const aiMessage = { role: "assistant", text: data.response };
      setMessages((prev) => [...prev, aiMessage]);

      if (chatId && sessionId) {
        await fetch(`${import.meta.env.VITE_API_URL}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
          body: JSON.stringify({
            sessionId,
            chatId,
            role: "assistant",
            message: data.response,
            images: [],
            classId,
          }),
        });
      }
    } catch (err) {
      console.error("Error submitting message:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `❌ ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  //https://poe2-ai-helper.onrender.com/api/upload
  // http://localhost:3000/api/upload
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
    <div className="flex-grow-1 overflow-auto chatBox">
      <div
        className="container flex-grow-1 overflow-auto p-3 mb-5"
        style={{ height: "60vh" }}
      >
        {Array.isArray(messages) &&
          messages.map((msg, i) => (
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
              >
                {msg.role === "assistant" ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatAssistantText(msg.text),
                    }}
                  />
                ) : (
                  <div>
                    {msg.images &&
                      msg.images.length > 0 &&
                      msg.images.map((src, idx) => (
                        <div key={idx}>
                          <img
                            src={src}
                            alt={"user uploaded image"}
                            className="chatImage"
                          />
                        </div>
                      ))}
                    {msg.text}
                  </div>
                )}
              </div>
            </div>
          ))}

        {/* waiting for ai response */}
        {loading && (
          <div className="text-secondary small mb-3">🧠 Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* user input */}
      <div className="userBar">
        <form onSubmit={handleSubmit} className="input-group">
          <button
            onClick={handleNewChat}
            type="button"
            className="btn submitBtn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              className="bi bi-plus-lg"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"
              />
            </svg>
          </button>
          <TextareaAutosize
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            maxRows={6}
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
              className="bi bi-arrow-up"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default User;
