import React from "react";
import "./PopupModal.css";

const PopupModal = ({ title, onClose, children }) => {
  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>×</button>
        <h2>{title}</h2>
        <div className="popup-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PopupModal;
