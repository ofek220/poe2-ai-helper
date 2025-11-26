import React, { useState, useEffect, useRef } from "react";
import ImageUpload from "./ImageUpload";
import TextareaAutosize from "react-textarea-autosize";

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

    // https://poe2-ai-helper.onrender.com/api/generate
    // http://localhost:3000/api/generate
    try {
      let imagesUploaded = [];

      if (images.length > 0) {
        const uploadFormData = new FormData();
        images.forEach((file) => uploadFormData.append("images", file));

        const uploadRes = await fetch("http://localhost:3000/api/upload", {
          method: "POST",
          credentials: "include",
          body: uploadFormData,
        });

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

      const formData = new FormData();
      formData.append("prompt", prompt);
      imagesUploaded.forEach((url) => {
        formData.append("imageUrls", url);
      });

      const res = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

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
      console.error("❌ Full Error:", err);
      let userVisibleMessage;

      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("CORS")
      ) {
        userVisibleMessage =
          "❌ Network Error: Could not connect to the server.";
      } else {
        userVisibleMessage = `❌ Request Failed: ${err.message}`;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: userVisibleMessage },
      ]);
    } finally {
      setLoading(false);
    }
  };

  //https://poe2-ai-helper.onrender.com/api/upload
  const handleNewChat = async () => {
    const allImageUrls = messages
      .filter((msg) => msg.images && msg.images.length > 0)
      .flatMap((msg) => msg.images);

    if (allImageUrls.length > 0) {
      try {
        await fetch("http://localhost:3000/api/upload", {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrls: allImageUrls }),
        });
        console.log(" Deleted images from server");
      } catch (error) {
        console.error("Failed to delete images:", error);
      }
    }
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
    <div className=" flex-grow-1 overflow-auto chatBox">
      <div
        className="container flex-grow-1 overflow-auto p-3 mb-5"
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
                  {msg.text && msg.text}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* wating for ai response */}
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
