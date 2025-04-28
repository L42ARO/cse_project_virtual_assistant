import React, { useState, useEffect } from "react";
import "./Modal.css";

const Modal = ({ isOpen, onClose, title, children, renderFooter }) => {
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setClosing(false); 
        }
    }, [isOpen]);

    if (!isOpen && !closing) return null;

    const handleClose = () => {
        setClosing(true);   
        setTimeout(() => {  
            onClose();      
            setClosing(false); 
        }, 250);            
    };    

    return (
        <div className={`modal-overlay ${closing ? "modal-fadeout" : ""}`}>
            <div className={`modal-content ${closing ? "modal-slideout" : ""}`}>
                <div className="modal-header">
                    {title && <h2 className="modal-title">{title}</h2>}
                    <button className="modal-close" onClick={handleClose}>
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;