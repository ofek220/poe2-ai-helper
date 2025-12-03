import React from "react";
import heic2any from "heic2any";

const ImageUpload = ({ images, setImages, previews, setPreviews }) => {
  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setImages(selectedFiles);
      const previewUrls = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileName = file.name.toLowerCase();
          if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
            await convertToJped(file);
          } else {
            return URL.createObjectURL(file);
          }
        })
      );
      setPreviews(previewUrls);
    }
  };

  const convertToJped = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (window.heic2any) {
            const blob = await heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 0.8,
            });
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23ddd" width="50" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em">📷</text></svg>'
            );
          }
        } catch (error) {
          console.error("HEIC conversion failed:", error);
          resolve(
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23ddd" width="50" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em">📷</text></svg>'
          );
        }
      };
      reader.readAsArrayBuffer(file);
    });
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
      <div className="userbar">
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
    </div>
  );
};

export default ImageUpload;
