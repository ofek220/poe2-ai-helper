import { Routes, Route, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import LoginForm from "./auth/LoginForm";
import TitleScreen from "./pages/TitleScreen";
import AiChat from "./pages/AiChat";
import SkillTreeCanvas from "./pages/SkillTreeCanvas";
import GlobalNavBar from "./layout/GlobalNavBar";

const LOCAL_KEY = "savedChats_v1";

let sessionId = localStorage.getItem("sessionId");
if (!sessionId) {
  sessionId = uuidv4();
  localStorage.setItem("sessionId", sessionId);
}

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("https://poe2-ai-helper.onrender.com/api/check", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setLoggedIn(data.loggedIn));
  }, []);

  if (!loggedIn) {
    return (
      <LoginForm
        loading={loading}
        setLoading={setLoading}
        onLoginSuccess={() => {
          setLoggedIn(true);
          setLoading(false);
        }}
      />
    );
  }

  const Layout = () => {
    return (
      <div className="container-fluid main-div">
        <GlobalNavBar />
        <div className="flex-grow-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    );
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<TitleScreen />} />
        <Route path="/skillTree" element={<SkillTreeCanvas />} />
      </Route>

      <Route path="/chat/:classId" element={<AiChat loggedIn={loggedIn} />} />
    </Routes>
  );
};

export default App;
