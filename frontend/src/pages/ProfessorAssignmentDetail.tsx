import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { professorAPI } from '../services/api';
import { validateByType } from '../utils/fileValidation';
import './ProfessorAssignmentDetail.css';

interface Submission {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  submission_text: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  files: Array<{
    id: number;
    file_name: string;
    file_size: number;
    uploaded_at: string;
  }>;
}

interface Assignment {
  id: number;
  title: string;
  description: string | null;
  question_text: string | null;
  due_date: string | null;
  points: number;
  course_id: number;
  assignmentFiles: Array<{
    id: number;
    file_name: string;
    file_size: number;
    uploaded_at: string;
  }>;
}

const ProfessorAssignmentDetail: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    questionText: '',
    dueDate: '',
    points: 100
  });

  useEffect(() => {
    if (assignmentId) {
      loadAssignmentDetails();
      loadSubmissions();
    }
  }, [assignmentId]);

  const loadAssignmentDetails = async () => {
    try {
      setLoading(true);
      // Fetch assignment files
      const filesResponse = await professorAPI.getAssignmentFiles(parseInt(assignmentId!));

      // Get the assignment details from the assignments list
      const assignmentsResponse = await professorAPI.getAssignments();
      const assignmentData = assignmentsResponse.data.assignments.find(
        (a: any) => a.id === parseInt(assignmentId!)
      );

      if (assignmentData) {
        setAssignment({
          ...assignmentData,
          assignmentFiles: filesResponse.data.files || []
        });
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load assignment details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    try {
      const response = await professorAPI.getSubmissions(parseInt(assignmentId!));
      setSubmissions(response.data.submissions || []);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load submissions', 'error');
    }
  };

  const handleUploadAssignmentFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validation = validateByType(files, 'courseMaterials');
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file selection', 'error');
      e.target.value = '';
      return;
    }

    try {
      setUploadingFiles(true);
      await professorAPI.uploadAssignmentFiles(parseInt(assignmentId!), files);
      showToast(`${files.length} file(s) uploaded successfully`, 'success');
      loadAssignmentDetails();
      e.target.value = '';
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to upload files', 'error');
      e.target.value = '';
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteAssignmentFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await professorAPI.deleteAssignmentFile(parseInt(assignmentId!), fileId);
      showToast('File deleted successfully', 'success');
      loadAssignmentDetails();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete file', 'error');
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    const grade = parseInt(gradeForm.grade);
    if (isNaN(grade) || grade < 0 || grade > (assignment?.points || 100)) {
      showToast(`Grade must be between 0 and ${assignment?.points || 100}`, 'error');
      return;
    }

    try {
      await professorAPI.gradeSubmission(selectedSubmission.id, {
        grade,
        feedback: gradeForm.feedback || undefined,
      });
      showToast('Submission graded successfully', 'success');
      setSelectedSubmission(null);
      setGradeForm({ grade: '', feedback: '' });
      loadSubmissions();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to grade submission', 'error');
    }
  };

  const handleDownloadSubmissionFile = async (fileId: number) => {
    try {
      const response = await professorAPI.downloadSubmissionFile(fileId);
      window.open(response.data.url, '_blank');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to download file', 'error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const openGradeModal = (submission: Submission) => {
    setSelectedSubmission(submission);
    setGradeForm({
      grade: submission.grade?.toString() || '',
      feedback: submission.feedback || '',
    });
  };

  const openEditModal = () => {
    if (!assignment) return;

    // Format the date for datetime-local input
    let formattedDate = '';
    if (assignment.due_date) {
      const date = new Date(assignment.due_date);
      formattedDate = date.toISOString().slice(0, 16);
    }

    setEditForm({
      title: assignment.title,
      description: assignment.description || '',
      questionText: assignment.question_text || '',
      dueDate: formattedDate,
      points: assignment.points
    });
    setShowEditModal(true);
  };

  const handleEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    try {
      await professorAPI.updateAssignment(assignment.id, {
        title: editForm.title,
        description: editForm.description || undefined,
        questionText: editForm.questionText || undefined,
        dueDate: editForm.dueDate || undefined,
        points: editForm.points
      });
      showToast('Assignment updated successfully', 'success');
      setShowEditModal(false);
      loadAssignmentDetails();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to update assignment', 'error');
    }
  };

  if (loading) {
    return <div className="loading">Loading assignment details...</div>;
  }

  if (!assignment) {
    return <div className="error">Assignment not found</div>;
  }

  const submittedCount = submissions.length;
  const gradedCount = submissions.filter(s => s.grade !== null).length;

  return (
    <div className="professor-assignment-detail-page">
      <header className="page-header">
        <div className="header-content">
          <div className="breadcrumb">
            <Link to="/dashboard">Back to Dashboard</Link>
          </div>
          <div className="header-actions">
            <span className="user-info">Welcome, {user?.fullName}</span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>
      </header>

      <main className="page-main">
        <div className="assignment-detail-container">
          {/* Assignment Information Section */}
          <div className="assignment-info-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h1 style={{ margin: 0 }}>{assignment.title}</h1>
              <button onClick={openEditModal} className="btn-edit" title="Edit Assignment">
                ✏️ Edit
              </button>
            </div>
            <div className="assignment-meta">
              {assignment.due_date && (
                <span className="due-date">Due: {new Date(assignment.due_date).toLocaleString()}</span>
              )}
              <span className="points">{assignment.points} points</span>
              <span className="submission-stats">
                {submittedCount} submission{submittedCount !== 1 ? 's' : ''} • {gradedCount} graded
              </span>
            </div>

            {assignment.description && (
              <div className="info-block">
                <h2>Description</h2>
                <p>{assignment.description}</p>
              </div>
            )}

            {assignment.question_text && (
              <div className="info-block">
                <h2>Assignment Question</h2>
                <p className="question-text">{assignment.question_text}</p>
              </div>
            )}

            {/* Assignment Files */}
            <div className="info-block">
              <div className="section-header">
                <h2>Assignment Files</h2>
                <label htmlFor="assignment-file-upload" className="btn-secondary" style={{ cursor: 'pointer' }}>
                  {uploadingFiles ? 'Uploading...' : '+ Add Files'}
                  <input
                    id="assignment-file-upload"
                    type="file"
                    multiple
                    onChange={handleUploadAssignmentFiles}
                    style={{ display: 'none' }}
                    disabled={uploadingFiles}
                  />
                </label>
              </div>

              {assignment.assignmentFiles && assignment.assignmentFiles.length > 0 ? (
                <div className="files-list">
                  {assignment.assignmentFiles.map((file) => (
                    <div key={file.id} className="file-item">
                      <span className="file-icon">📄</span>
                      <div className="file-info">
                        <span className="file-name">{file.file_name}</span>
                        <span className="file-size">{formatFileSize(file.file_size)}</span>
                      </div>
                      <button
                        className="btn-delete-icon"
                        onClick={() => handleDeleteAssignmentFile(file.id)}
                        title="Delete file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-message">No files attached to this assignment</p>
              )}
            </div>
          </div>

          {/* Submissions Section */}
          <div className="submissions-section">
            <h2>Student Submissions</h2>

            {submissions.length === 0 ? (
              <p className="empty-message">No submissions yet</p>
            ) : (
              <div className="submissions-list">
                {submissions.map((submission) => (
                  <div key={submission.id} className="submission-card">
                    <div className="submission-header">
                      <div className="student-info">
                        <h3>{submission.student_name}</h3>
                        <p className="student-email">{submission.student_email}</p>
                      </div>
                      <div className="submission-meta">
                        {submission.grade !== null ? (
                          <span className="grade-badge graded">
                            {submission.grade}/{assignment.points}
                          </span>
                        ) : (
                          <span className="grade-badge not-graded">Not Graded</span>
                        )}
                      </div>
                    </div>

                    <div className="submission-body">
                      <p className="submitted-date">
                        Submitted: {new Date(submission.submitted_at).toLocaleString()}
                      </p>

                      {submission.submission_text && (
                        <div className="submission-text">
                          <strong>Answer:</strong>
                          <p>{submission.submission_text}</p>
                        </div>
                      )}

                      {submission.files && submission.files.length > 0 && (
                        <div className="submission-files">
                          <strong>Attached Files:</strong>
                          <div className="files-list">
                            {submission.files.map((file) => (
                              <div key={file.id} className="file-item">
                                <span className="file-icon">📎</span>
                                <span className="file-name">{file.file_name}</span>
                                <span className="file-size">{formatFileSize(file.file_size)}</span>
                                <button
                                  className="btn-link"
                                  onClick={() => handleDownloadSubmissionFile(file.id)}
                                >
                                  Download
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {submission.feedback && (
                        <div className="submission-feedback">
                          <strong>Feedback:</strong>
                          <p>{submission.feedback}</p>
                        </div>
                      )}
                    </div>

                    <div className="submission-footer">
                      <button
                        className="btn-primary"
                        onClick={() => openGradeModal(submission)}
                      >
                        {submission.grade !== null ? 'Update Grade' : 'Grade Submission'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Grading Modal */}
      {selectedSubmission && (
        <div className="modal-overlay" onClick={() => setSelectedSubmission(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Grade Submission - {selectedSubmission.student_name}</h3>
            <form onSubmit={handleGradeSubmission}>
              <div className="form-group">
                <label>Grade (out of {assignment.points})</label>
                <input
                  type="number"
                  value={gradeForm.grade}
                  onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
                  min="0"
                  max={assignment.points}
                  required
                />
              </div>
              <div className="form-group">
                <label>Feedback (Optional)</label>
                <textarea
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                  rows={5}
                  placeholder="Enter feedback for the student..."
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Assignment</h3>
            <form onSubmit={handleEditAssignment}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Question</label>
                <textarea
                  value={editForm.questionText}
                  onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                  placeholder="Enter the assignment question or instructions..."
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="datetime-local"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Points</label>
                <input
                  type="number"
                  value={editForm.points}
                  onChange={(e) => setEditForm({ ...editForm, points: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorAssignmentDetail;
