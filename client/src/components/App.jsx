import { Routes, Route, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import LoginForm from "./auth/LoginForm";
import TitleScreen from "./pages/TitleScreen";
import AiChat from "./pages/AiChat";
import SkillTreeCanvas from "./pages/SkillTreeCanvas";
import GlobalNavBar from "./layout/GlobalNavBar";

const LOCAL_KEY = "savedChats_v1";
const TOKEN_KEY = "authToken";

let sessionId = localStorage.getItem("sessionId");
if (!sessionId) {
  sessionId = uuidv4();
  localStorage.setItem("sessionId", sessionId);
}

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (token) {
      fetch("https://poe2-ai-helper.onrender.com/api/check", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.loggedIn) {
            setLoggedIn(true);
          } else {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        });
    }
  }, [token]);

  const handleLoginSuccess = (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setLoggedIn(true);
    setLoading(false);
  };

  if (!loggedIn) {
    return (
      <LoginForm
        loading={loading}
        setLoading={setLoading}
        onLoginSuccess={handleLoginSuccess}
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
