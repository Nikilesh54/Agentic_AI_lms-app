import React, { useEffect, useState, useRef } from 'react';
import { chatAPI } from '../services/api';
import type {
  ResponseSource,
  TrustScore,
} from '../types/agenticai';
import {
  getTrustScoreColor,
  getTrustLevelLabel,
} from '../types/agenticai';
import './MessageMetadata.css';

interface MessageMetadataProps {
  messageId: number;
  metadata: any;
}

const MessageMetadata: React.FC<MessageMetadataProps> = ({ messageId, metadata }) => {
  const [sources, setSources] = useState<ResponseSource[]>([]);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingTrust, setLoadingTrust] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const trustDropdownRef = useRef<HTMLDivElement>(null);
  const sourcesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSources();
    fetchTrustScore();
  }, [messageId]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close trust score dropdown if clicked outside
      if (trustDropdownRef.current && !trustDropdownRef.current.contains(event.target as Node)) {
        // Check if the click was on the trust badge button
        const target = event.target as HTMLElement;
        if (!target.closest('.trust-badge')) {
          setShowDetails(false);
        }
      }

      // Close sources dropdown if clicked outside
      if (sourcesDropdownRef.current && !sourcesDropdownRef.current.contains(event.target as Node)) {
        // Check if the click was on the sources badge button
        const target = event.target as HTMLElement;
        if (!target.closest('.sources-badge')) {
          setShowSources(false);
        }
      }
    };

    // Add event listener when either dropdown is open
    if (showDetails || showSources) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetails, showSources]);

  const fetchSources = async () => {
    try {
      const response = await chatAPI.getSources(messageId);
      setSources(response.data.sources || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  };

  const fetchTrustScore = async () => {
    try {
      // Add a small delay since verification runs in background
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await chatAPI.getTrustScore(messageId);
      setTrustScore(response.data.trustScore);
    } catch (error: any) {
      // Trust score might not be ready yet
      if (error.response?.status === 404) {
        // Retry after a delay
        setTimeout(() => {
          fetchTrustScore();
        }, 3000);
      }
    } finally {
      setLoadingTrust(false);
    }
  };

  const sourcesCount = metadata?.sourcesCount || sources.length;

  return (
    <div className="message-metadata">
      {/* Quick Stats */}
      <div className="metadata-quick-stats">
        {!loadingSources && sourcesCount > 0 && (
          <button
            className="metadata-badge sources-badge"
            onClick={() => setShowSources(!showSources)}
            title="View sources"
          >
            📚 {sourcesCount} {sourcesCount === 1 ? 'Source' : 'Sources'}
          </button>
        )}

        {loadingTrust ? (
          <span className="metadata-badge verifying-badge">
            ⏳ Verifying...
          </span>
        ) : trustScore ? (
          <button
            className="metadata-badge trust-badge"
            style={{ borderColor: getTrustScoreColor(trustScore.trust_score) }}
            onClick={() => setShowDetails(!showDetails)}
            title="View verification details"
          >
            <span className="trust-icon" style={{ color: getTrustScoreColor(trustScore.trust_score) }}>
              {trustScore.trust_score >= 70 ? '✓' : trustScore.trust_score >= 50 ? '⚠' : '✗'}
            </span>
            Trust: {trustScore.trust_score}/100
          </button>
        ) : null}
      </div>

      {/* Sources Dropdown */}
      {showSources && sources.length > 0 && (
        <div className="metadata-dropdown sources-dropdown" ref={sourcesDropdownRef}>
          <div className="dropdown-header">
            <h4>📚 Sources Referenced</h4>
            <button className="close-btn" onClick={() => setShowSources(false)}>✕</button>
          </div>
          <div className="dropdown-content">
            {sources.map((source, index) => (
              <div key={source.id} className="source-item">
                <div className="source-header">
                  <span className="source-number">{index + 1}</span>
                  <span className="source-type-badge">{source.source_type}</span>
                </div>
                <div className="source-details">
                  {source.source_type === 'course_material' ? (
                    <>
                      <div className="source-name">
                        📄 {source.source_name}
                        {source.page_number && <span className="page-info"> (Page {source.page_number})</span>}
                      </div>
                      {source.source_excerpt && (
                        <div className="source-excerpt">"{source.source_excerpt}"</div>
                      )}
                    </>
                  ) : source.source_type === 'internet' ? (
                    <>
                      <div className="source-name">🌐 {source.source_name}</div>
                      {source.source_url && (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          {source.source_url}
                        </a>
                      )}
                      {source.source_excerpt && (
                        <div className="source-excerpt">"{source.source_excerpt}"</div>
                      )}
                    </>
                  ) : (
                    <div className="source-name">{source.source_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trust Score Details Dropdown */}
      {showDetails && trustScore && (
        <div className="metadata-dropdown trust-dropdown" ref={trustDropdownRef}>
          <div className="dropdown-header">
            <h4>🔍 Verification Details</h4>
            <button className="close-btn" onClick={() => setShowDetails(false)}>✕</button>
          </div>
          <div className="dropdown-content">
            <div className="trust-score-display">
              <div
                className="trust-score-circle"
                style={{ borderColor: getTrustScoreColor(trustScore.trust_score) }}
              >
                <span className="score-number" style={{ color: getTrustScoreColor(trustScore.trust_score) }}>
                  {trustScore.trust_score}
                </span>
                <span className="score-label">/ 100</span>
              </div>
              <div className="trust-level-label" style={{ color: getTrustScoreColor(trustScore.trust_score) }}>
                {getTrustLevelLabel(trustScore.trust_level)}
              </div>
            </div>

            <div className="verification-section">
              <h5>Reasoning:</h5>
              <p>{trustScore.verification_reasoning}</p>
            </div>

            {trustScore.source_verification_details?.evidence_summary && (
              <div className="verification-section">
                <h5>Evidence Summary:</h5>
                <p>{trustScore.source_verification_details.evidence_summary}</p>
              </div>
            )}

            {trustScore.conflicts_detected && trustScore.conflicts_detected.length > 0 && (
              <div className="verification-section conflicts">
                <h5>⚠ Conflicts Detected:</h5>
                <ul>
                  {trustScore.conflicts_detected.map((conflict, index) => (
                    <li key={index}>{conflict}</li>
                  ))}
                </ul>
              </div>
            )}

            {trustScore.source_verification_details?.verification_details &&
             trustScore.source_verification_details.verification_details.length > 0 && (
              <div className="verification-section">
                <h5>Source Verification:</h5>
                {trustScore.source_verification_details.verification_details.map((detail, index) => (
                  <div key={index} className="verification-detail">
                    <div className="detail-header">
                      <strong>{detail.source}</strong>
                      <span className={`match-badge ${detail.match_quality}`}>
                        {detail.match_quality}
                      </span>
                    </div>
                    <p className="detail-evidence">{detail.evidence}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="verified-by">
              <small>Verified by: {trustScore.verified_by}</small>
              <small>at {new Date(trustScore.verification_timestamp).toLocaleString()}</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageMetadata;
