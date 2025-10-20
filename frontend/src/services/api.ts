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

  createAssignment: (data: { title: string; description?: string; dueDate?: string; points?: number }) =>
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
};

export default apiClient;
