import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { studentAPI, gradingAssistantAPI } from '../services/api';
import { validateByType } from '../utils/fileValidation';
import type { TentativeGrade } from '../types/agenticai';
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
  const [tentativeGrade, setTentativeGrade] = useState<TentativeGrade | null>(null);
  const [loadingTentativeGrade, setLoadingTentativeGrade] = useState(false);

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

      // If there's already a submission, populate the form and load tentative grade
      if (response.data.assignment.submission) {
        setSubmissionText(response.data.assignment.submission.submission_text || '');
        const submissionId = response.data.assignment.submission.id;
        if (submissionId) {
          loadTentativeGrade(submissionId);
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTentativeGrade = async (submissionId: number) => {
    try {
      setLoadingTentativeGrade(true);
      const response = await gradingAssistantAPI.getTentativeGrade(submissionId);
      setTentativeGrade(response.data.tentativeGrade);
    } catch (error: any) {
      // Tentative grade might not exist yet, which is okay
      console.log('No tentative grade yet:', error.response?.data?.error);
    } finally {
      setLoadingTentativeGrade(false);
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

          {hasSubmitted && tentativeGrade && !tentativeGrade.is_final && submission.grade === null && (
            <div className="assignment-section tentative-grade-section">
              <div className="tentative-grade-header">
                <h2>AI-Generated Preliminary Grade</h2>
                <div className="disclaimer-banner">
                  <span className="warning-icon">⚠️</span>
                  <span className="disclaimer-text">
                    This is a preliminary grade generated by AI. Your final grade is pending professor review and may differ.
                  </span>
                </div>
              </div>

              <div className="tentative-grade-score">
                <div className="score-circle">
                  <span className="score-number">{tentativeGrade.tentative_grade}</span>
                  <span className="score-divider">/</span>
                  <span className="score-max">{tentativeGrade.max_points}</span>
                </div>
                <div className="score-percentage">
                  {Math.round((tentativeGrade.tentative_grade / tentativeGrade.max_points) * 100)}%
                </div>
                {tentativeGrade.confidence_score && (
                  <div className="confidence-indicator">
                    <small>Confidence: {Math.round(tentativeGrade.confidence_score * 100)}%</small>
                  </div>
                )}
              </div>

              {tentativeGrade.rubric_breakdown && tentativeGrade.rubric_breakdown.length > 0 && (
                <div className="rubric-breakdown">
                  <h3>Rubric Breakdown</h3>
                  <div className="rubric-table">
                    {tentativeGrade.rubric_breakdown.map((item, index) => (
                      <div key={index} className="rubric-item">
                        <div className="rubric-item-header">
                          <span className="criterion-name">{item.criterion}</span>
                          <span className="criterion-points">
                            {item.points_awarded} / {item.points_possible} pts
                          </span>
                        </div>
                        <div className="rubric-item-justification">
                          {item.justification}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tentativeGrade.strengths && tentativeGrade.strengths.length > 0 && (
                <div className="feedback-section strengths-section">
                  <h3>✓ Strengths</h3>
                  <ul className="strengths-list">
                    {tentativeGrade.strengths.map((strength, index) => (
                      <li key={index}>
                        <span className="check-icon">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tentativeGrade.areas_for_improvement && tentativeGrade.areas_for_improvement.length > 0 && (
                <div className="feedback-section improvements-section">
                  <h3>⚡ Areas for Improvement</h3>
                  <ul className="improvements-list">
                    {tentativeGrade.areas_for_improvement.map((improvement, index) => (
                      <li key={index}>
                        <span className="improve-icon">⚡</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tentativeGrade.grading_rationale && (
                <div className="feedback-section overall-feedback">
                  <h3>Overall Feedback</h3>
                  <p>{tentativeGrade.grading_rationale}</p>
                </div>
              )}

              <div className="tentative-grade-footer">
                <small className="generated-at">
                  Generated on {new Date(tentativeGrade.generated_at).toLocaleString()}
                </small>
              </div>
            </div>
          )}

          {loadingTentativeGrade && hasSubmitted && submission.grade === null && (
            <div className="assignment-section tentative-grade-loading">
              <div className="loading-spinner"></div>
              <p>Generating preliminary grade...</p>
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
