import React from "react";
import "./FlaggedQuestionList.css";

const FlaggedQuestionList = ({ flaggedQuestions }) => {
    if (!flaggedQuestions || flaggedQuestions.length === 0) {
        return <p className="empty-state">No flagged questions.</p>;
    }

    return (
        <div className="flagged-questions-container">
            {flaggedQuestions.map((fq) => (
                <div key={fq.id} className="flagged-question-card">
                    <p className="flagged-question-text">📝 {fq.question}</p>
                    <p className="flagged-status">
                        📤 Sent to professor: <strong>{fq.sentToProfessor ? "✅" : "❌"}</strong>
                    </p>
                    {fq.professorReply ? (
                        <div className="flagged-reply">
                            <p>📥 Reply:</p>
                            <p className="reply-text">{fq.professorReply}</p>
                        </div>
                    ) : (
                        <p className="reply-pending">⌛ Awaiting reply...</p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default FlaggedQuestionList;
