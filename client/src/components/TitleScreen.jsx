import React from "react";
import { useNavigate } from "react-router-dom";
import "../titleScreen.css";
import WindowSize from "./WindowSize";

const assetPath = (filename) =>
  `${import.meta.env.BASE_URL}assets/classes_images/${filename}`;

const classes = [
  // for path 4.0 druid is the latest class
  {
    id: "general",
    img: assetPath("general.jpg"),
    alt: "general chat",
  },
  {
    id: "sorceress",
    img: assetPath("poe-2-art-sorceress-1024x468.png"),
    alt: "sorceress chat",
  },
  {
    id: "warrior",
    img: assetPath("poe-2-art-Warrior-1024x468.png"),
    alt: "warrior chat",
  },
  {
    id: "druid",
    img: assetPath("poe-2-art-druid-1024x468.png"),
    alt: "druid chat",
  },
  {
    id: "witch",
    img: assetPath("poe-2-art-witch-1024x468.png"),
    alt: "witch chat",
  },
  {
    id: "huntress",
    img: assetPath("poe-2-art-huntress-1024x468.png"),
    alt: "huntress chat",
  },
  {
    id: "mercenary",
    img: assetPath("poe-2-art-mercenary-1024x468.png"),
    alt: "mercenary chat",
  },
  {
    id: "monk",
    img: assetPath("poe-2-art-monk-1024x468.png"),
    alt: "monk chat",
  },
  {
    id: "ranger",
    img: assetPath("poe-2-art-ranger-1024x468.png"),
    alt: "ranger chat",
  },
];
const TitleScreen = () => {
  let navigate = useNavigate();

  return (
    <div className="title-screen">
      <div className="chat-images-area container h-screen ">
        <div className="image-grid row justify-content-center ">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="chat-images col-6 col-sm-6 col-md-4 col-lg-3 mb-4 d-flex flex-column align-items-center"
            >
              <h1 className="chat-title text-center">{cls.alt}</h1>
              <img
                className="img-fluid rounded-4 d-flex mt-auto"
                id={cls.id}
                src={cls.img}
                alt={cls.alt}
                onClick={() => navigate(`/chat/${cls.id}`)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TitleScreen;
