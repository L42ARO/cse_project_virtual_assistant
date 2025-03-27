import React, { useState } from "react";
import "./CourseDropdown.css";

const CourseDropdown = ({ courses, onSelectCourse, onNewCourseClick, showNewCourseOption, value }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (course) => {
    onSelectCourse(course); // Notify parent component
    setIsOpen(false); // Close dropdown after selection
  };

  return (
    <div className="dropdown-container">
      <button className="dropdown-button" onClick={() => setIsOpen(!isOpen)}>
        {value} ▼
      </button>

      {isOpen && (
        <ul className="dropdown-list">
          {courses.map((course, index) => (
            <li
              key={index}
              onClick={() => handleSelect(course)}
              className="dropdown-item"
            >
              {course}
            </li>
          ))}

          {showNewCourseOption && (
            <li className="dropdown-item new-course" onClick={() => {
              onNewCourseClick?.();
              setIsOpen(false);
            }}>
              ＋ New Course
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default CourseDropdown;
