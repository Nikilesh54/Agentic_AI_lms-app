import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { studentAPI } from '../services/api';
import { validateByType, formatFileSize as formatSize, getAllowedTypesDescription } from '../utils/fileValidation';
import './AssignmentSubmission.css';

const AssignmentSubmission: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (assignmentId) {
      loadAssignment();
    }
  }, [assignmentId]);

  const loadAssignment = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getAssignment(parseInt(assignmentId!));
      setAssignment(response.data.assignment);

      // If there's already a submission, populate the form
      if (response.data.assignment.submission) {
        setSubmissionText(response.data.assignment.submission.submission_text || '');
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setSelectedFiles(null);
      return;
    }

    // Client-side validation
    const validation = validateByType(files, 'studentSubmissions');
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file selection', 'error');
      e.target.value = ''; // Reset file input
      setSelectedFiles(null);
      return;
    }

    setSelectedFiles(files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!submissionText && (!selectedFiles || selectedFiles.length === 0)) {
      showToast('Please enter text or upload files', 'error');
      return;
    }

    // Revalidate files before submission (in case they were set programmatically)
    if (selectedFiles && selectedFiles.length > 0) {
      const validation = validateByType(selectedFiles, 'studentSubmissions');
      if (!validation.valid) {
        showToast(validation.error || 'Invalid file selection', 'error');
        setSelectedFiles(null);
        return;
      }
    }

    try {
      setSubmitting(true);
      await studentAPI.submitAssignment(parseInt(assignmentId!), {
        submissionText,
        files: selectedFiles || undefined,
      });
      showToast('Assignment submitted successfully', 'success');
      loadAssignment(); // Reload to show the updated submission
      setSelectedFiles(null); // Reset selected files
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to submit assignment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadAssignmentFile = async (fileId: number) => {
    try {
      const response = await studentAPI.downloadAssignmentFile(fileId);
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

  if (loading) {
    return <div className="loading">Loading assignment...</div>;
  }

  if (!assignment) {
    return <div className="error">Assignment not found</div>;
  }

  const submission = assignment.submission;
  const hasSubmitted = !!submission;

  return (
    <div className="assignment-submission-page">
      <header className="page-header">
        <div className="header-content">
          <div className="breadcrumb">
            <Link to={`/courses/${assignment.course_id}`}>Back to Course</Link>
          </div>
          <div className="header-actions">
            <span className="user-info">Welcome, {user?.fullName}</span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>
      </header>

      <main className="page-main">
        <div className="assignment-container">
          <div className="assignment-header-section">
            <h1>{assignment.title}</h1>
            {assignment.due_date && (
              <p className="due-date">
                Due: {new Date(assignment.due_date).toLocaleString()}
              </p>
            )}
            <p className="points">{assignment.points} points</p>
          </div>

          {assignment.description && (
            <div className="assignment-section">
              <h2>Description</h2>
              <p>{assignment.description}</p>
            </div>
          )}

          {assignment.question_text && (
            <div className="assignment-section question-section">
              <h2>Assignment Question</h2>
              <div className="question-text">{assignment.question_text}</div>
            </div>
          )}

          {assignment.assignmentFiles && assignment.assignmentFiles.length > 0 && (
            <div className="assignment-section">
              <h2>Assignment Files</h2>
              <div className="files-list">
                {assignment.assignmentFiles.map((file: any) => (
                  <div key={file.id} className="file-item">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{file.file_name}</span>
                    <span className="file-size">{formatFileSize(file.file_size)}</span>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDownloadAssignmentFile(file.id)}
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasSubmitted && submission.grade !== null && (
            <div className="assignment-section grade-section">
              <h2>Your Grade</h2>
              <div className="grade-display">
                <span className="grade-value">{submission.grade} / {assignment.points}</span>
              </div>
              {submission.feedback && (
                <div className="feedback">
                  <h3>Feedback:</h3>
                  <p>{submission.feedback}</p>
                </div>
              )}
            </div>
          )}

          <div className="assignment-section submission-section">
            <h2>{hasSubmitted ? 'Your Submission' : 'Submit Assignment'}</h2>

            {hasSubmitted ? (
              <div className="existing-submission">
                <p className="submission-info">
                  Submitted on: {new Date(submission.submitted_at).toLocaleString()}
                </p>

                {submission.submission_text && (
                  <div className="submission-text-display">
                    <h3>Your Answer:</h3>
                    <p>{submission.submission_text}</p>
                  </div>
                )}

                {submission.files && submission.files.length > 0 && (
                  <div className="submitted-files">
                    <h3>Submitted Files:</h3>
                    <div className="files-list">
                      {submission.files.map((file: any) => (
                        <div key={file.id} className="file-item">
                          <span className="file-icon">📎</span>
                          <span className="file-name">{file.file_name}</span>
                          <span className="file-size">{formatFileSize(file.file_size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="resubmit-info">
                  <p>You can update your submission below:</p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="submission-form">
              <div className="form-group">
                <label>Your Answer</label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  rows={8}
                  placeholder="Enter your answer here..."
                />
              </div>

              <div className="form-group">
                <label>Attach Files (Optional)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip"
                />
                {selectedFiles && selectedFiles.length > 0 && (
                  <div className="selected-files">
                    <p>Selected files:</p>
                    <ul>
                      {Array.from(selectedFiles).map((file, index) => (
                        <li key={index}>
                          {file.name} ({formatFileSize(file.size)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : hasSubmitted ? 'Update Submission' : 'Submit Assignment'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AssignmentSubmission;
