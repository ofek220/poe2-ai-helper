import { useState, useEffect } from "react";

const WindowSize = ({ savedChats, children }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`d-flex align-items-center me-2 ${
        savedChats.length > 10 || window.innerWidth < 768 ? "chatSelect" : ""
      }`}
    >
      {children}
    </div>
  );
};

export default WindowSize;
