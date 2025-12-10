import React, { useState, useEffect } from "react";
import { TypeAnimation } from "react-type-animation";

const JokesArray = [
  { text: "Hello", delay: 1000 },
  { text: "Why did the password break up? Too many characters.", delay: 2000 },
  { text: "I tried logging in, but my coffee logged in first.", delay: 2000 },
  {
    text: "Forgot password? Even computers have memory problems.",
    delay: 2000,
  },
  { text: "Logging in is like magic, but with more typing.", delay: 2000 },
  { text: "Why was the keyboard tired? Too many shift keys.", delay: 2000 },
  {
    text: "Why don’t passwords ever lie? They always hash it out.",
    delay: 2000,
  },
  { text: "Login attempt failed… even my coffee is judging me.", delay: 2000 },
  { text: "I typed 'password123'… the system laughed silently.", delay: 2000 },
  {
    text: "Computers never panic… until you forget your username.",
    delay: 2000,
  },
  {
    text: "Two-factor authentication: because one factor isn’t enough fun.",
    delay: 2000,
  },
  { text: "Logging in is basically digital hide-and-seek.", delay: 2000 },
  { text: "Password hint: it’s not 'password'. Surprise!", delay: 2000 },
  { text: "Autofill tried… but it gave up halfway.", delay: 2000 },
  { text: "Caps Lock: the silent password destroyer.", delay: 1500 },
  { text: "Wi-Fi password? More like Wi-Fight password.", delay: 1500 },
  { text: "Login screens: testing patience since forever.", delay: 1500 },
  { text: "Forgot your password? Congrats, you’re human.", delay: 1500 },
];

const LoginForm = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [Jokes, setJokes] = useState(JokesArray);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("https://poe2-ai-helper.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (res.ok) onLoginSuccess();
    else {
      setLoading(false);
      alert("Invalid password");
    }
  };

  useEffect(() => {
    const shuffleArray = (array) => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    const shuffled = shuffleArray(JokesArray);
    const sequence = shuffled.flatMap((joke) => [joke.text, joke.delay]);
    setJokes(sequence);
  }, []);

  return (
    <div className="login-container form-group">
      <h2>Please log in</h2>

      <form onSubmit={handleLogin}>
        <input
          className="form-control"
          type="password"
          placeholder="Password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="btn btn-outline-light"
          disabled={loading || !password.trim()}
        >
          {loading ? <h4 className="loading">Loading</h4> : null}
          {loading ? (
            <TypeAnimation
              repeat={Infinity}
              speed={75}
              deletionSpeed={90}
              sequence={Jokes.length > 0 ? Jokes : ["Loading...", 1000]}
            />
          ) : (
            <span>Login</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
