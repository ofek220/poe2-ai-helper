import React, { useState, useEffect, useRef } from "react";
import ImageUpload from "./ImageUpload";
import TextareaAutosize from "react-textarea-autosize";
import { getAuthHeaders } from "../auth/Auth";
import MiniSkillTree from "../layout/MiniSkillTree";

const User = ({ initialMessages = [], onNewChat, chatId, classId }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [treeToggleButton, setTreeToggleButton] = useState(false);
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
          treeToggleButton: treeToggleButton,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (!data.response) {
        throw new Error("No response content received");
      }

      const aiMessage = {
        role: "assistant",
        text: data.response,
        buildData:
          data.passiveNodeIds || data.ascendancyNodeIds
            ? {
                selectedNodes: [
                  ...(data.passiveNodeIds || []),
                  ...(data.ascendancyNodeIds || []),
                ],
                ascendancyChosen: data.ascendancyChosen || "None",
              }
            : null,
      };

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
            buildData: aiMessage.buildData,
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

  const handleNewChat = () => {
    setMessages([]);
    setPrompt("");
    setImages([]);
    setPreviews([]);
    setTreeToggleButton(false);
    if (onNewChat) onNewChat();
  };

  const formatAssistantText = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/###\s*(.+)/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  };

  const renderTreeToggle = () => {
    return (
      <div
        className="tree-container d-flex align-items-center bg-white border-end border-start px-2"
        style={{ position: "relative" }}
      >
        {/* Explanation Box */}
        <div
          className="shadow-sm tree-explanation-popup collapse"
          id="treeHelpDetails"
          style={{
            position: "absolute",
            bottom: "120%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "150px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            zIndex: 20,
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            color: "#000",
            pointerEvents: "none",
          }}
        >
          <div
            className="p-2 text-center"
            style={{ fontSize: "0.7rem", color: "#000", fontWeight: "500" }}
          >
            AI Tree Analysis Mode: Lets the AI see all notable and keystone
            nodes.
          </div>
        </div>

        {/* Floating Toggle Arrow */}
        <div
          className="d-flex justify-content-center collapsed"
          data-bs-toggle="collapse"
          data-bs-target="#treeHelpDetails"
          style={{
            position: "absolute",
            top: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            cursor: "pointer",
            color: "#8B0000",
            zIndex: 25,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            borderRadius: "50%",
            padding: "3px",
            boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="currentColor"
            className="mobileTreeArrowToggle"
            viewBox="0 0 16 16"
          >
            <path
              fillRule="evenodd"
              d="M7.776 5.553a.5.5 0 0 1 .448 0l6 3a.5.5 0 1 1-.448.894L8 6.56 2.224 9.447a.5.5 0 1 1-.448-.894z"
            />
          </svg>
        </div>

        {/* tree button */}
        <div className="d-flex align-items-center">
          <input
            type="checkbox"
            className="btn-check"
            id="treeHelpToggle"
            checked={treeToggleButton}
            onChange={(e) => setTreeToggleButton(e.target.checked)}
            autoComplete="off"
          />
          <label
            className="btn btn-sm d-flex align-items-center justify-content-center p-0"
            htmlFor="treeHelpToggle"
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: treeToggleButton ? "#8B0000" : "transparent",
              color: treeToggleButton ? "#FFFFFF" : "#FF0000",
              border: treeToggleButton ? "none" : "1px solid #dee2e6",
              borderRadius: "4px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M8.416.223a.5.5 0 0 0-.832 0l-3 4.5A.5.5 0 0 0 5 5.5h.098L3.076 8.735A.5.5 0 0 0 3.5 9.5h.191l-1.638 3.276a.5.5 0 0 0 .447.724H7V16h2v-2.5h4.5a.5.5 0 0 0 .447-.724L12.31 9.5h.191a.5.5 0 0 0 .424-.765L10.902 5.5H11a.5.5 0 0 0 .416-.777zM6.437 4.758A.5.5 0 0 0 6 4.5h-.066L8 1.401 10.066 4.5H10a.5.5 0 0 0-.424.765L11.598 8.5H11.5a.5.5 0 0 0-.447.724L12.69 12.5H3.309l1.638-3.276A.5.5 0 0 0 4.5 8.5h-.098l2.022-3.235a.5.5 0 0 0 .013-.507" />
            </svg>
          </label>
        </div>
      </div>
    );
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
                  <>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatAssistantText(msg.text),
                      }}
                    />
                    {msg.buildData &&
                      msg.buildData.selectedNodes.length > 0 && (
                        <div style={{ marginTop: "15px" }}>
                          <MiniSkillTree
                            selectedNodes={msg.buildData.selectedNodes}
                            classId={classId}
                            selectedAscendancy={msg.buildData.ascendancyChosen}
                          />
                        </div>
                      )}
                  </>
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

          {renderTreeToggle()}

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
