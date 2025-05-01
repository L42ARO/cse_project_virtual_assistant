import React, { useCallback, useMemo } from "react";
import { useServer } from "./serverContext";

export const useAPI = () => {
  const { serverURL } = useServer();

  // --- Memoized fetchAPI ---
  // Memoize fetchAPI because other memoized functions below depend on it.
  // Its only external dependency is serverURL.
  const fetchAPI = useCallback(async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body instanceof FormData) {
      delete headers['Content-Type']; // FormData sets its own
    }
    const config = { ...options, headers };

    try {
      let url = `${serverURL}${endpoint}`; // Depends on serverURL
      if (options.params) {
        const queryParams = new URLSearchParams(options.params).toString();
        url += `?${queryParams}`;
      }
      const response = await fetch(url, config);
      if (response.status === 204) return { ok: true, data: null };
      const responseData = await response.json();
      if (!response.ok) {
        const errorMessage = responseData?.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }
      return responseData;
    } catch (error) {
      console.error("API Request Failed:", endpoint, error);
      return { ok: false, error: error.message || "An unknown error occurred" };
    }
  }, [serverURL]); // Dependency: serverURL

  // --- Memoized Core Functions ---

  // Memoize each function that will be returned or used as a dependency.
  // List the stable functions/variables they depend on (e.g., fetchAPI) in the dependency array.

  const fetchHttpMessage = useCallback(async () => {
    return await fetchAPI("/simple-http");
  }, [fetchAPI]); // Depends on the memoized fetchAPI

  const fetchDelayedHttpMessage = useCallback(async () => {
    return await fetchAPI("/delayed-http");
  }, [fetchAPI]); // Depends on fetchAPI


  const sendChatMessage = useCallback((socket, message) => {
    if (!socket) return;
    socket.emit("send_chat", { message: message.trim() });
  }, []); // No dependencies from useAPI scope

  const sccChatStart = useCallback(async (userId, courseId, initialMessage, token) => {
    const payload = { user_id: userId, token, initial_message: initialMessage.trim(), course_id: courseId };
    return await fetchAPI("/scc/chat-start", { method: "POST", body: JSON.stringify(payload) });
  }, [fetchAPI]); // Depends on fetchAPI

  const sccChatCont = useCallback((socket, session_id, message, token) => {
    if (!socket) return;
    const payload = { token, session_id, message: message.trim() };
    socket.emit("ws_scc_chat_cont", payload);
  }, []);

  const sccGetSessions = useCallback(async (token, courseId = null) => {
    const payload = { token };
    if (courseId) payload.course_id = courseId;
    return await fetchAPI("/scc/sessions-get", { method: "POST", body: JSON.stringify(payload) });
  }, [fetchAPI]);

  const sccGetSessionMessages = useCallback(async (token, threadId) => {
    const payload = { token, thread_id: threadId };
    return await fetchAPI("/scc/session-messages-get", { method: "POST", body: JSON.stringify(payload) });
  }, [fetchAPI]);

  const pccChatIntro = useCallback(async (courseId, token) => {
    const payload = { course_id: courseId, token };
    return await fetchAPI("/pcc/chat-intro", { method: "POST", body: JSON.stringify(payload) });
  }, [fetchAPI]);

  const pccChatStart = useCallback(async (userId, courseId, initialMessage, token) => {
    const payload = { user_id: userId, token, initial_message: initialMessage.trim(), course_id: courseId };
    return await fetchAPI("/pcc/chat-start", { method: "POST", body: JSON.stringify(payload) });
  }, [fetchAPI]);

  const pccChatCont = useCallback((socket, session_id, message, token) => {
    if (!socket) return;
    const payload = { token, message: message.trim(), session_id };
    socket.emit("ws_pcc_chat_cont", payload);
  }, []);

  const createNewCourse = useCallback(async (professorId, key, initialMessage, courseName, courseSection, courseTerm) => {
    const payload = { professor_id: professorId, key, initial_message: initialMessage.trim(), course_name: courseName, course_section: courseSection, course_term: courseTerm };
    return await fetchAPI("/pcc/new-course", { method: "POST", body: JSON.stringify(payload) });
  }, [fetchAPI]);

  // uploadFile uses serverURL directly, not fetchAPI helper
  const uploadFile = useCallback(async (file, courseId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("course_id", courseId);
    try {
      // Need serverURL here
      const response = await fetch(`${serverURL}/pcc/upload-file`, { method: "POST", body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("File Upload Failed:", error);
      return { error: error.message };
    }
  }, [serverURL]); // Depends on serverURL

  const fetchUsers = useCallback(async () => {
    return await fetchAPI("/users/get-users");
  }, [fetchAPI]);

  const loginUser = useCallback(async (username, password) => {
    const payload = { username, password };
    try {
      // Uses fetchAPI
      const response = await fetchAPI("/users/login", { method: "POST", body: JSON.stringify(payload) });
      if (response.error) throw new Error(response.error);
      return response;
    } catch (error) {
      console.error("Login API error:", error);
      return { error: error.message };
    }
  }, [fetchAPI]); // Depends on fetchAPI

  // ----- Functions relevant to the original problem -----
  const getCourseMaterials = useCallback(async (courseId) => {
    return await fetchAPI(`/pcc/course-materials`, { method: 'GET', params: { course_id: courseId } });
  }, [fetchAPI]); // Depends on fetchAPI

  const deleteCourseMaterial = useCallback(async (courseId, fileId) => {
    // call the generic fetchAPI
    const result = await fetchAPI(
      `/pcc/course-materials`,
      { method: 'DELETE', params: { course_id: courseId, file_id: fileId } }
    );
    if (result.ok === false) {
      // pass the error through
      return { ok: false, error: result.error };
    }
    // success path – wrap it in an “ok” flag
    return { ok: true, message: result.message || 'Deleted' };
  }, [fetchAPI]);

  const getAiSettings = useCallback(async (courseId) => {
    return await fetchAPI(`/pcc/ai-settings`, { method: 'GET', params: { course_id: courseId } });
  }, [fetchAPI]); // Depends on fetchAPI

  const updateAiSettings = useCallback(async (courseId, instructions) => {
    const payload = { course_id: courseId, instructions };
    return await fetchAPI(`/pcc/ai-settings`, { method: 'PUT', body: JSON.stringify(payload) });
  }, [fetchAPI]); // Depends on fetchAPI

  const getInsights = useCallback(async (courseId) => {
    const payload = { course_id: courseId };
    return await fetchAPI("/pcc/question-insights", { method: "POST", body: JSON.stringify(payload) });
}, [fetchAPI]);

  // Fetch flagged questions (both mandatory & voluntary)
  const getFlags = useCallback(async (courseId) => {
    // POST to /pcc/flagged-notifications with { course_id }
    return await fetchAPI(
      "/pcc/flagged-notifications",
      { method: "POST", body: JSON.stringify({ course_id: courseId }) }
    );
  }, [fetchAPI]);

  const sccChatHistorySearch = useCallback(async (token, searchQuery) => {
    const payload = { token, search_query: searchQuery };
    return await fetchAPI("/scc/chat-history-search", { method: "POST", body: JSON.stringify(payload) });
}, [fetchAPI]);

  // --- Memoize the returned object ---
  // This ensures the object reference itself is stable if the functions within are stable.
  return useMemo(() => ({
    fetchHttpMessage,
    fetchDelayedHttpMessage,
    sendChatMessage,
    sccChatStart,
    sccChatCont,
    sccGetSessions,
    sccGetSessionMessages,
    sccChatHistorySearch,
    pccChatIntro,
    pccChatStart,
    pccChatCont,
    createNewCourse,
    uploadFile,
    fetchUsers,
    loginUser,
    getCourseMaterials,
    deleteCourseMaterial,
    getAiSettings,
    updateAiSettings,
    getInsights,
    getFlags,
  }), [ // List all memoized functions returned
    fetchHttpMessage,
    fetchDelayedHttpMessage,
    sendChatMessage,
    sccChatStart,
    sccChatCont,
    sccGetSessions,
    sccGetSessionMessages,
    sccChatHistorySearch,
    pccChatIntro,
    pccChatStart,
    pccChatCont,
    createNewCourse,
    uploadFile,
    fetchUsers,
    loginUser,
    getCourseMaterials,
    deleteCourseMaterial,
    getAiSettings,
    updateAiSettings,
    getInsights,
    getFlags,
  ]);
};