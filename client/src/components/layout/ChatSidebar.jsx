import React from "react";

function ChatSidebar({
  savedChats = [],
  activeChat,
  onLoadChat,
  onNewChat,
  chatToDelete,
  setChatToDelete,
  onDeleteChat,
  onClearAll,
  onClose,
}) {
  return (
    <div className="d-flex flex-column h-100 p-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Chats</h5>
        <div className="d-flex">
          <button className="btn btn-sm btn-primary" onClick={onNewChat}>
            + New
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-grow-1  mb-3">
        {savedChats.length > 0 ? (
          <ul className="nav flex-column">
            {savedChats.map((chat) => (
              <li key={chat.id} className="nav-item">
                <button
                  className={`nav-link w-100 text-start ${
                    activeChat?.id === chat.id ? "active" : ""
                  }`}
                  onClick={() => {
                    onLoadChat(chat.id);
                    if (onClose) onClose();
                  }}
                >
                  {chat.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted small mt-3 ps-2">
            No chats yet — create one!
          </div>
        )}
      </div>

      {/* Delete controls */}
      {savedChats.length > 0 && (
        <div className="mt-auto pt-3 border-top">
          <select
            className="form-select form-select-sm mb-2"
            value={chatToDelete}
            onChange={(e) => setChatToDelete(e.target.value)}
            style={{
              cursor: "pointer",
            }}
          >
            <option value="">Select to delete...</option>
            {savedChats.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.name}
              </option>
            ))}
          </select>

          <div className="d-grid gap-2">
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => onDeleteChat(chatToDelete)}
              disabled={!chatToDelete}
              style={{ color: "#ffffff" }}
            >
              Delete Selected
            </button>
            <button className="btn btn-danger btn-sm" onClick={onClearAll}>
              Clear All CLASSES Chats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatSidebar;
