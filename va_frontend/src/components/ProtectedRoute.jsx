import { Navigate, Outlet } from "react-router-dom";
import React from "react";

const ProtectedRoute = ({ allowedRoles }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/ui/login" replace />;  // Redirect if not logged in
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;  // Redirect if role is not allowed
  }

  return <Outlet />;  // Allow access to the protected route
};

export default ProtectedRoute;
