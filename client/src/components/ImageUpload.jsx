import React from "react";

const ImageUpload = ({ images, setImages, previews, setPreviews }) => {
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setImages(selectedFiles);
      const previewUrls = selectedFiles.map((file) =>
        URL.createObjectURL(file)
      );
      setPreviews(previewUrls);
    }
  };

  const clearImages = (i) => {
    const newImageArr = images.filter((img, index) => index !== i);
    URL.revokeObjectURL(previews[i]);
    const newPreviewArr = previews.filter((img, index) => index !== i);
    return setPreviews(newPreviewArr), setImages(newImageArr);
  };

  return (
    <div className="card p-2 text-center" style={{ maxWidth: "fit-content" }}>
      <input
        id="image-upload"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <label
        htmlFor="image-upload"
        className="btn submitBtn"
        style={{ cursor: "pointer", position: "relative" }}
        title="Attach Images"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          className="bi bi-paperclip"
          viewBox="0 0 16 16"
        >
          <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z" />
        </svg>

        {previews.length > 0 && <span>{previews.length}</span>}
      </label>

      {previews.length > 0 && (
        <div className="prevImgPos">
          {previews.map((src, i) => (
            <div key={i}>
              <img className="imgPreview" src={src} alt={`Preview ${i}`} />
              <button
                className="clrImg"
                type="button"
                onClick={() => clearImages(i)}
                title="Clear images"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
