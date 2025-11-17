import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { professorAPI, gradingAssistantAPI } from '../services/api';
import { validateByType } from '../utils/fileValidation';
import type { TentativeGrade, GradingRubric } from '../types/agenticai';
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

  // Rubric and grading assistant state
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [rubric, setRubric] = useState<GradingRubric | null>(null);
  const [rubricForm, setRubricForm] = useState({
    rubricName: '',
    criteria: [{ name: '', description: '', points: 0, excellent_description: '', good_description: '', fair_description: '', poor_description: '' }]
  });
  const [tentativeGrades, setTentativeGrades] = useState<{ [submissionId: number]: TentativeGrade }>({});
  const [loadingTentativeGrade, setLoadingTentativeGrade] = useState<{ [submissionId: number]: boolean }>({});
  const [showTentativeGradeModal, setShowTentativeGradeModal] = useState(false);
  const [selectedTentativeGrade, setSelectedTentativeGrade] = useState<TentativeGrade | null>(null);
  const [finalizingGrade, setFinalizingGrade] = useState(false);

  useEffect(() => {
    if (assignmentId) {
      loadAssignmentDetails();
      loadSubmissions();
      loadRubric();
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
      const subs = response.data.submissions || [];
      setSubmissions(subs);

      // Load tentative grades for all submissions
      subs.forEach((sub: Submission) => {
        loadTentativeGrade(sub.id);
      });
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load submissions', 'error');
    }
  };

  const loadRubric = async () => {
    try {
      const response = await gradingAssistantAPI.getRubric(parseInt(assignmentId!));
      setRubric(response.data.rubric);
    } catch (error: any) {
      // Rubric might not exist yet, which is okay
      console.log('No rubric found:', error.response?.data?.error);
    }
  };

  const loadTentativeGrade = async (submissionId: number) => {
    try {
      setLoadingTentativeGrade(prev => ({ ...prev, [submissionId]: true }));
      const response = await gradingAssistantAPI.getTentativeGrade(submissionId);
      if (response.data.tentativeGrade) {
        setTentativeGrades(prev => ({ ...prev, [submissionId]: response.data.tentativeGrade }));
      }
    } catch (error: any) {
      // Tentative grade might not exist yet
      console.log(`No tentative grade for submission ${submissionId}`);
    } finally {
      setLoadingTentativeGrade(prev => ({ ...prev, [submissionId]: false }));
    }
  };

  const handleGenerateTentativeGrade = async (submissionId: number) => {
    try {
      setLoadingTentativeGrade(prev => ({ ...prev, [submissionId]: true }));
      await gradingAssistantAPI.generateTentativeGrade(submissionId);
      showToast('Tentative grade generated successfully', 'success');
      loadTentativeGrade(submissionId);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to generate tentative grade', 'error');
      setLoadingTentativeGrade(prev => ({ ...prev, [submissionId]: false }));
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

  const openRubricModal = () => {
    if (rubric) {
      // Edit existing rubric
      setRubricForm({
        rubricName: rubric.rubric_name,
        criteria: rubric.criteria.map(c => ({
          name: c.name,
          description: c.description,
          points: c.points,
          excellent_description: c.excellent_description || '',
          good_description: c.good_description || '',
          fair_description: c.fair_description || '',
          poor_description: c.poor_description || ''
        }))
      });
    } else {
      // Create new rubric
      setRubricForm({
        rubricName: '',
        criteria: [{ name: '', description: '', points: 0, excellent_description: '', good_description: '', fair_description: '', poor_description: '' }]
      });
    }
    setShowRubricModal(true);
  };

  const handleAddCriterion = () => {
    setRubricForm({
      ...rubricForm,
      criteria: [...rubricForm.criteria, { name: '', description: '', points: 0, excellent_description: '', good_description: '', fair_description: '', poor_description: '' }]
    });
  };

  const handleRemoveCriterion = (index: number) => {
    setRubricForm({
      ...rubricForm,
      criteria: rubricForm.criteria.filter((_, i) => i !== index)
    });
  };

  const handleCriterionChange = (index: number, field: string, value: any) => {
    const newCriteria = [...rubricForm.criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setRubricForm({ ...rubricForm, criteria: newCriteria });
  };

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    // Validation
    if (!rubricForm.rubricName.trim()) {
      showToast('Please enter a rubric name', 'error');
      return;
    }

    if (rubricForm.criteria.length === 0) {
      showToast('Please add at least one criterion', 'error');
      return;
    }

    for (let i = 0; i < rubricForm.criteria.length; i++) {
      const criterion = rubricForm.criteria[i];
      if (!criterion.name.trim() || !criterion.description.trim() || criterion.points <= 0) {
        showToast(`Criterion ${i + 1}: Please fill in all required fields`, 'error');
        return;
      }
    }

    const totalPoints = rubricForm.criteria.reduce((sum, c) => sum + c.points, 0);

    try {
      await gradingAssistantAPI.createRubric({
        assignmentId: assignment.id,
        rubricName: rubricForm.rubricName,
        criteria: rubricForm.criteria,
        totalPoints
      });
      showToast('Rubric created successfully', 'success');
      setShowRubricModal(false);
      loadRubric();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create rubric', 'error');
    }
  };

  const openTentativeGradeModal = (tentativeGrade: TentativeGrade) => {
    setSelectedTentativeGrade(tentativeGrade);
    setShowTentativeGradeModal(true);
  };

  const handleFinalizeGrade = async (acceptAiGrade: boolean) => {
    if (!selectedTentativeGrade) return;

    const finalGrade = acceptAiGrade ? selectedTentativeGrade.tentative_grade : parseFloat(gradeForm.grade);
    const feedback = gradeForm.feedback || selectedTentativeGrade.grading_rationale;

    if (!acceptAiGrade && (isNaN(finalGrade) || finalGrade < 0 || finalGrade > (assignment?.points || 100))) {
      showToast(`Grade must be between 0 and ${assignment?.points || 100}`, 'error');
      return;
    }

    try {
      setFinalizingGrade(true);
      await gradingAssistantAPI.finalizeGrade(selectedTentativeGrade.id, {
        finalGrade,
        feedback
      });
      showToast('Grade finalized successfully', 'success');
      setShowTentativeGradeModal(false);
      setSelectedTentativeGrade(null);
      setGradeForm({ grade: '', feedback: '' });
      loadSubmissions();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to finalize grade', 'error');
    } finally {
      setFinalizingGrade(false);
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

            {/* Grading Rubric */}
            <div className="info-block">
              <div className="section-header">
                <h2>Grading Rubric</h2>
                <button onClick={openRubricModal} className="btn-secondary">
                  {rubric ? 'View/Edit Rubric' : '+ Create Rubric'}
                </button>
              </div>

              {rubric ? (
                <div className="rubric-summary">
                  <p><strong>{rubric.rubric_name}</strong></p>
                  <p>Total Points: {rubric.total_points}</p>
                  <p>{rubric.criteria.length} criteria</p>
                </div>
              ) : (
                <p className="empty-message">No rubric created yet. Create one to enable AI-assisted grading.</p>
              )}
            </div>

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

                    {/* Tentative Grade Display */}
                    {tentativeGrades[submission.id] && !tentativeGrades[submission.id].is_final && submission.grade === null && (
                      <div className="tentative-grade-preview">
                        <div className="tentative-grade-header">
                          <span>AI Preliminary Grade: {tentativeGrades[submission.id].tentative_grade}/{tentativeGrades[submission.id].max_points}</span>
                          {tentativeGrades[submission.id].confidence_score && (
                            <span className="confidence">
                              (Confidence: {Math.round(tentativeGrades[submission.id].confidence_score * 100)}%)
                            </span>
                          )}
                        </div>
                        <button
                          className="btn-link"
                          onClick={() => openTentativeGradeModal(tentativeGrades[submission.id])}
                        >
                          View Details & Finalize
                        </button>
                      </div>
                    )}

                    <div className="submission-footer">
                      {submission.grade === null && !tentativeGrades[submission.id] && !loadingTentativeGrade[submission.id] && (
                        <button
                          className="btn-secondary"
                          onClick={() => handleGenerateTentativeGrade(submission.id)}
                          style={{ marginRight: '10px' }}
                        >
                          Generate AI Grade
                        </button>
                      )}
                      {loadingTentativeGrade[submission.id] && (
                        <span style={{ marginRight: '10px' }}>Generating AI grade...</span>
                      )}
                      <button
                        className="btn-primary"
                        onClick={() => openGradeModal(submission)}
                      >
                        {submission.grade !== null ? 'Update Grade' : 'Grade Manually'}
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

      {/* Rubric Creation Modal */}
      {showRubricModal && (
        <div className="modal-overlay" onClick={() => setShowRubricModal(false)}>
          <div className="modal-content rubric-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{rubric ? 'View/Edit Rubric' : 'Create Grading Rubric'}</h3>
            <form onSubmit={handleCreateRubric}>
              <div className="form-group">
                <label>Rubric Name *</label>
                <input
                  type="text"
                  value={rubricForm.rubricName}
                  onChange={(e) => setRubricForm({ ...rubricForm, rubricName: e.target.value })}
                  placeholder="e.g., Essay Grading Rubric"
                  required
                />
              </div>

              <div className="criteria-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4>Grading Criteria</h4>
                  <button type="button" onClick={handleAddCriterion} className="btn-secondary">
                    + Add Criterion
                  </button>
                </div>

                {rubricForm.criteria.map((criterion, index) => (
                  <div key={index} className="criterion-card" style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h5>Criterion {index + 1}</h5>
                      {rubricForm.criteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(index)}
                          className="btn-delete-icon"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        value={criterion.name}
                        onChange={(e) => handleCriterionChange(index, 'name', e.target.value)}
                        placeholder="e.g., Thesis Statement"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Description *</label>
                      <textarea
                        value={criterion.description}
                        onChange={(e) => handleCriterionChange(index, 'description', e.target.value)}
                        placeholder="What does this criterion assess?"
                        rows={2}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Points *</label>
                      <input
                        type="number"
                        value={criterion.points}
                        onChange={(e) => handleCriterionChange(index, 'points', parseInt(e.target.value) || 0)}
                        min="0"
                        required
                      />
                    </div>

                    <details style={{ marginTop: '10px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
                        Performance Level Descriptions (Optional)
                      </summary>

                      <div className="form-group">
                        <label>Excellent</label>
                        <textarea
                          value={criterion.excellent_description}
                          onChange={(e) => handleCriterionChange(index, 'excellent_description', e.target.value)}
                          placeholder="What constitutes excellent performance?"
                          rows={2}
                        />
                      </div>

                      <div className="form-group">
                        <label>Good</label>
                        <textarea
                          value={criterion.good_description}
                          onChange={(e) => handleCriterionChange(index, 'good_description', e.target.value)}
                          placeholder="What constitutes good performance?"
                          rows={2}
                        />
                      </div>

                      <div className="form-group">
                        <label>Fair</label>
                        <textarea
                          value={criterion.fair_description}
                          onChange={(e) => handleCriterionChange(index, 'fair_description', e.target.value)}
                          placeholder="What constitutes fair performance?"
                          rows={2}
                        />
                      </div>

                      <div className="form-group">
                        <label>Poor</label>
                        <textarea
                          value={criterion.poor_description}
                          onChange={(e) => handleCriterionChange(index, 'poor_description', e.target.value)}
                          placeholder="What constitutes poor performance?"
                          rows={2}
                        />
                      </div>
                    </details>
                  </div>
                ))}

                <div className="rubric-total" style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px', marginTop: '15px' }}>
                  <strong>Total Points: {rubricForm.criteria.reduce((sum, c) => sum + c.points, 0)}</strong>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowRubricModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {rubric ? 'Update Rubric' : 'Create Rubric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tentative Grade Details Modal */}
      {showTentativeGradeModal && selectedTentativeGrade && (
        <div className="modal-overlay" onClick={() => setShowTentativeGradeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>AI-Generated Preliminary Grade</h3>

            <div className="tentative-grade-details">
              <div className="grade-summary" style={{ textAlign: 'center', padding: '20px', background: '#f0f9ff', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#0066cc' }}>
                  {selectedTentativeGrade.tentative_grade}/{selectedTentativeGrade.max_points}
                </div>
                <div style={{ fontSize: '18px', color: '#666', marginTop: '5px' }}>
                  {Math.round((selectedTentativeGrade.tentative_grade / selectedTentativeGrade.max_points) * 100)}%
                </div>
                {selectedTentativeGrade.confidence_score && (
                  <div style={{ marginTop: '10px', color: '#888' }}>
                    AI Confidence: {Math.round(selectedTentativeGrade.confidence_score * 100)}%
                  </div>
                )}
              </div>

              {selectedTentativeGrade.rubric_breakdown && selectedTentativeGrade.rubric_breakdown.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4>Rubric Breakdown</h4>
                  {selectedTentativeGrade.rubric_breakdown.map((item, index) => (
                    <div key={index} style={{ padding: '10px', border: '1px solid #e0e0e0', borderRadius: '5px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '5px' }}>
                        <span>{item.criterion}</span>
                        <span>{item.points_awarded}/{item.points_possible} pts</span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{item.justification}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTentativeGrade.strengths && selectedTentativeGrade.strengths.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#10b981' }}>Strengths</h4>
                  <ul>
                    {selectedTentativeGrade.strengths.map((strength, index) => (
                      <li key={index} style={{ color: '#059669', marginBottom: '5px' }}>{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTentativeGrade.areas_for_improvement && selectedTentativeGrade.areas_for_improvement.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#f59e0b' }}>Areas for Improvement</h4>
                  <ul>
                    {selectedTentativeGrade.areas_for_improvement.map((improvement, index) => (
                      <li key={index} style={{ color: '#d97706', marginBottom: '5px' }}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTentativeGrade.grading_rationale && (
                <div style={{ marginBottom: '20px' }}>
                  <h4>Overall Feedback</h4>
                  <p style={{ padding: '10px', background: '#f9fafb', borderRadius: '5px' }}>
                    {selectedTentativeGrade.grading_rationale}
                  </p>
                </div>
              )}

              <div style={{ borderTop: '2px solid #e0e0e0', paddingTop: '20px', marginTop: '20px' }}>
                <h4>Finalize Grade</h4>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                  You can accept the AI-generated grade or override it with your own assessment.
                </p>

                <div className="form-group">
                  <label>Override Grade (Optional)</label>
                  <input
                    type="number"
                    value={gradeForm.grade}
                    onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
                    placeholder={`Leave empty to use AI grade (${selectedTentativeGrade.tentative_grade})`}
                    min="0"
                    max={selectedTentativeGrade.max_points}
                  />
                </div>

                <div className="form-group">
                  <label>Additional Feedback (Optional)</label>
                  <textarea
                    value={gradeForm.feedback}
                    onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                    placeholder="Add your own feedback or leave empty to use AI feedback"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowTentativeGradeModal(false);
                  setGradeForm({ grade: '', feedback: '' });
                }}
                className="btn-secondary"
                disabled={finalizingGrade}
              >
                Cancel
              </button>
              <button
                onClick={() => handleFinalizeGrade(true)}
                className="btn-primary"
                disabled={finalizingGrade}
                style={{ marginRight: '10px' }}
              >
                {finalizingGrade ? 'Finalizing...' : 'Accept AI Grade'}
              </button>
              {gradeForm.grade && (
                <button
                  onClick={() => handleFinalizeGrade(false)}
                  className="btn-primary"
                  disabled={finalizingGrade}
                >
                  {finalizingGrade ? 'Finalizing...' : 'Finalize with Override'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorAssignmentDetail;
