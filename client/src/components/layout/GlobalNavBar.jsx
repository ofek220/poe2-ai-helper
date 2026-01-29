import React from "react";
import { useNavigate } from "react-router-dom";

const GlobalNavBar = ({ showChatHamburger = false, onToggleChatSidebar }) => {
  const navigate = useNavigate();

  const sendToMainPage = () => {
    navigate("/");
  };

  const sendToSkillTree = () => {
    navigate("/skillTree");
  };

  return (
    <nav className="navbar navbar-light bg-light mb-2 navbar-dark">
      <div className="container-fluid d-flex align-items-center justify-content-start">
        {showChatHamburger && (
          <button
            className="navbar-toggler d-lg-none me-3"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#chatSidebarMobile"
            aria-controls="chatSidebarMobile"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
        )}
        <a
          className="navbar-brand d-flex align-items-center justify-content-center"
          style={{ cursor: "pointer" }}
          onClick={sendToMainPage}
        >
          <img
            src="../assets/homeButton.png"
            className="navbar-homeImgButton"
            alt="home button"
          ></img>
        </a>
        <a
          className="nav-link"
          onClick={sendToSkillTree}
          style={{ cursor: "pointer" }}
        >
          Skill Tree
        </a>
      </div>
    </nav>
  );
};

export default GlobalNavBar;
