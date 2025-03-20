import React, { useState } from "react";
import "./CourseDropdown.css";

const CourseDropdown = ({ courses, onSelectCourse }) => {
  const [selectedCourse, setSelectedCourse] = useState(courses[0] || "Select a Course");
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (course) => {
    setSelectedCourse(course);
    onSelectCourse(course); // Notify parent component
    setIsOpen(false); // Close dropdown after selection
  };

  return (
    <div className="dropdown-container">
      <button className="dropdown-button" onClick={() => setIsOpen(!isOpen)}>
        {selectedCourse} ▼
      </button>
      {isOpen && (
        <ul className="dropdown-list">
          {courses.map((course, index) => (
            <li key={index} onClick={() => handleSelect(course)} className="dropdown-item">
              {course}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CourseDropdown;
