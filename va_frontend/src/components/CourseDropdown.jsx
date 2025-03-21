import React, { useState } from "react";
import "./CourseDropdown.css";

const CourseDropdown = ({ courses, onSelectCourse }) => {
  // State to keep track of the currently selected course
  const [selectedCourse, setSelectedCourse] = useState("Select a Course");

  // State to control whether the dropdown is open or closed
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (course) => {
    setSelectedCourse(course);
    onSelectCourse(course); // Notify parent component
    setIsOpen(false); // Close dropdown after selection
  };

  return (
    <div className="dropdown-container">
      {/* Button that shows the selected course and toggles dropdown */}
      <button className="dropdown-button" onClick={() => setIsOpen(!isOpen)}>
        {selectedCourse} ▼
      </button>

      {/* Conditionally render the list only when dropdown is open */}
      {isOpen && (
        <ul className="dropdown-list">
          {/* Render each course as a clickable item */}
          {courses.map((course, index) => (
            <li
              key={course.id}
              onClick={() => handleSelect(course)}
              className="dropdown-item"
            >
              {course}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CourseDropdown;
