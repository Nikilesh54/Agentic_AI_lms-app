import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Root API
export const rootAPI = {
  getPendingProfessors: () =>
    apiClient.get('/root/professors/pending'),

  updateProfessorStatus: (professorId: number, status: string) =>
    apiClient.patch(`/root/professors/${professorId}/status`, { status }),

  getUsers: (params?: { role?: string; status?: string }) =>
    apiClient.get('/root/users', { params }),

  deleteUser: (userId: number) =>
    apiClient.delete(`/root/users/${userId}`),

  getCourses: () =>
    apiClient.get('/root/courses'),

  createCourse: (data: { title: string; description?: string; instructorId?: number }) =>
    apiClient.post('/root/courses', data),

  updateCourse: (courseId: number, data: { title?: string; description?: string; instructorId?: number }) =>
    apiClient.put(`/root/courses/${courseId}`, data),

  deleteCourse: (courseId: number) =>
    apiClient.delete(`/root/courses/${courseId}`),

  getEnrollments: () =>
    apiClient.get('/root/enrollments'),

  getStats: () =>
    apiClient.get('/root/stats'),

  getProfessors: () =>
    apiClient.get('/root/professors'),

  assignCourse: (professorId: number, courseId: number) =>
    apiClient.post(`/root/professors/${professorId}/courses`, { courseId }),

  removeCourse: (professorId: number, courseId: number) =>
    apiClient.delete(`/root/professors/${professorId}/courses/${courseId}`),

  deleteProfessor: (professorId: number) =>
    apiClient.delete(`/root/users/${professorId}`),

  // File management
  getAllMaterials: (params?: { courseId?: number; professorId?: number }) =>
    apiClient.get('/root/files/materials', { params }),

  getAllSubmissions: (params?: { courseId?: number; studentId?: number; assignmentId?: number }) =>
    apiClient.get('/root/files/submissions', { params }),

  getFileStats: () =>
    apiClient.get('/root/files/stats'),

  downloadFile: (type: 'material' | 'submission' | 'assignment', fileId: number) =>
    apiClient.get(`/root/files/download/${type}/${fileId}`),
};

// Professor API
export const professorAPI = {
  getCourse: () =>
    apiClient.get('/professor/course'),

  getStudents: () =>
    apiClient.get('/professor/students'),

  updateCourse: (data: { title?: string; description?: string }) =>
    apiClient.put('/professor/course', data),

  getAssignments: () =>
    apiClient.get('/professor/assignments'),

  createAssignment: (data: { title: string; description?: string; questionText?: string; dueDate?: string; points?: number }) =>
    apiClient.post('/professor/assignments', data),

  updateAssignment: (assignmentId: number, data: { title?: string; description?: string; dueDate?: string; points?: number }) =>
    apiClient.put(`/professor/assignments/${assignmentId}`, data),

  deleteAssignment: (assignmentId: number) =>
    apiClient.delete(`/professor/assignments/${assignmentId}`),

  getAnnouncements: () =>
    apiClient.get('/professor/announcements'),

  createAnnouncement: (data: { title: string; content: string }) =>
    apiClient.post('/professor/announcements', data),

  updateAnnouncement: (announcementId: number, data: { title?: string; content?: string }) =>
    apiClient.put(`/professor/announcements/${announcementId}`, data),

  deleteAnnouncement: (announcementId: number) =>
    apiClient.delete(`/professor/announcements/${announcementId}`),

  // Course Materials
  getMaterials: () =>
    apiClient.get('/professor/materials'),

  uploadMaterials: (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    return apiClient.post('/professor/materials', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteMaterial: (materialId: number) =>
    apiClient.delete(`/professor/materials/${materialId}`),

  downloadMaterial: (materialId: number) =>
    apiClient.get(`/professor/materials/${materialId}/download`),

  // Assignment Files
  getAssignmentFiles: (assignmentId: number) =>
    apiClient.get(`/professor/assignments/${assignmentId}/files`),

  uploadAssignmentFiles: (assignmentId: number, files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    return apiClient.post(`/professor/assignments/${assignmentId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteAssignmentFile: (assignmentId: number, fileId: number) =>
    apiClient.delete(`/professor/assignments/${assignmentId}/files/${fileId}`),

  // Submissions
  getSubmissions: (assignmentId: number) =>
    apiClient.get(`/professor/assignments/${assignmentId}/submissions`),

  gradeSubmission: (submissionId: number, data: { grade: number; feedback?: string }) =>
    apiClient.put(`/professor/submissions/${submissionId}/grade`, data),

  downloadSubmissionFile: (fileId: number) =>
    apiClient.get(`/professor/submissions/files/${fileId}/download`),
};

// Student API
export const studentAPI = {
  getCourses: () =>
    apiClient.get('/student/courses'),

  getMyCourses: () =>
    apiClient.get('/student/my-courses'),

  enrollInCourse: (courseId: number) =>
    apiClient.post(`/student/courses/${courseId}/enroll`),

  unenrollFromCourse: (courseId: number) =>
    apiClient.delete(`/student/courses/${courseId}/enroll`),

  getCourseDetails: (courseId: number) =>
    apiClient.get(`/student/courses/${courseId}`),

  getCourseAssignments: (courseId: number) =>
    apiClient.get(`/student/courses/${courseId}/assignments`),

  getCourseAnnouncements: (courseId: number) =>
    apiClient.get(`/student/courses/${courseId}/announcements`),

  // Course Materials
  getCourseMaterials: (courseId: number) =>
    apiClient.get(`/student/courses/${courseId}/materials`),

  downloadMaterial: (materialId: number) =>
    apiClient.get(`/student/materials/${materialId}/download`),

  // Assignments
  getAssignment: (assignmentId: number) =>
    apiClient.get(`/student/assignments/${assignmentId}`),

  submitAssignment: (assignmentId: number, data: { submissionText?: string; files?: FileList }) => {
    const formData = new FormData();
    if (data.submissionText) {
      formData.append('submissionText', data.submissionText);
    }
    if (data.files) {
      Array.from(data.files).forEach((file) => {
        formData.append('files', file);
      });
    }
    return apiClient.post(`/student/assignments/${assignmentId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getMySubmission: (assignmentId: number) =>
    apiClient.get(`/student/assignments/${assignmentId}/my-submission`),

  downloadAssignmentFile: (fileId: number) =>
    apiClient.get(`/student/assignments/files/${fileId}/download`),
};

// Chat API
export const chatAPI = {
  // Get enrolled courses for chat
  getCourses: () =>
    apiClient.get('/chat/courses'),

  // Create or get chat session
  createSession: (courseId: number) =>
    apiClient.post('/chat/sessions', { courseId }),

  // Get all sessions
  getSessions: (params?: { courseId?: number; status?: string }) =>
    apiClient.get('/chat/sessions', { params }),

  // Get messages for a session
  getMessages: (sessionId: number, params?: { limit?: number; offset?: number }) =>
    apiClient.get(`/chat/sessions/${sessionId}/messages`, { params }),

  // Send a message
  sendMessage: (sessionId: number, content: string) =>
    apiClient.post(`/chat/sessions/${sessionId}/messages`, { content }),

  // Archive a session
  archiveSession: (sessionId: number) =>
    apiClient.patch(`/chat/sessions/${sessionId}/archive`),

  // Regenerate last response
  regenerateResponse: (sessionId: number) =>
    apiClient.post(`/chat/sessions/${sessionId}/regenerate`),

  // Get generated content
  getGeneratedContent: (params?: { courseId?: number; contentType?: string; isSaved?: boolean }) =>
    apiClient.get('/chat/generated-content', { params }),

  // Save generated content
  saveGeneratedContent: (data: {
    sessionId: number;
    contentType: string;
    title?: string;
    content: string;
    metadata?: any;
  }) =>
    apiClient.post('/chat/generated-content', data),

  // Delete generated content
  deleteGeneratedContent: (contentId: number) =>
    apiClient.delete(`/chat/generated-content/${contentId}`),
};

export default apiClient;
