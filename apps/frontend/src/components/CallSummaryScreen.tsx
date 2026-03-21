import React, { useEffect, useState } from 'react';
import type { CallSummaryData } from '../lib/types';
import { EMOTIONS } from '../lib/constants';

interface CallSummaryScreenProps {
  summary: CallSummaryData;
  onDismiss: () => void;
}

const RECOMMENDATIONS: Record<string, string[]> = {
  joy: [
    "Share your energy with someone today.",
    "Write down what made you happy.",
    "Keep this momentum — reach out to a friend."
  ],
  sadness: [
    "Be gentle with yourself — emotions are valid.",
    "Try journaling your thoughts.",
    "Consider a short walk or light exercise."
  ],
  anxiety: [
    "Try the 4-7-8 breathing technique.",
    "Ground yourself: name 5 things you can see.",
    "Limit caffeine and take short breaks."
  ],
  anger: [
    "Physical movement helps process strong emotions.",
    "Write out your frustrations before responding.",
    "Give yourself space before re-engaging."
  ]
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CallSummaryScreen({ summary, onDismiss }: CallSummaryScreenProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // trigger entrance animation
    setShow(true);
  }, []);

  const emotionConfig = EMOTIONS.find((e) => e.key === summary.dominantEmotion) ?? EMOTIONS[0];
  const recs = RECOMMENDATIONS[summary.dominantEmotion] || RECOMMENDATIONS.joy;

  const totalEntries = Object.values(summary.emotionBreakdown).reduce((a, b) => (a || 0) + (b || 0), 0) || 1;

  return (
    <div className={`summary-screen ${show ? 'show' : ''}`}>
      <div className="summary-container">
        
        <div className="summary-header">
          <h1 className="summary-title">Session Complete</h1>
          <div className="summary-duration-badge">
            <span className="summary-duration-label">Duration</span>
            <span className="summary-duration-value">{formatDuration(summary.durationSeconds)}</span>
          </div>
        </div>

        <div className="summary-content">
          <div className="summary-emotion-card" style={{ '--accent': emotionConfig.accent, '--glow': emotionConfig.glow } as any}>
            <div className="summary-emotion-emoji">{emotionConfig.emoji}</div>
            <div className="summary-emotion-info">
              <span className="eyebrow">Dominant Emotion</span>
              <h2>{emotionConfig.title}</h2>
              <p>{emotionConfig.description}</p>
            </div>
          </div>

          <div className="summary-recs-section">
            <p className="eyebrow">Wellness Recommendations</p>
            <ul className="summary-recs">
              {recs.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {Object.keys(summary.emotionBreakdown).length > 1 && (
            <div className="summary-breakdown-section">
              <p className="eyebrow">Emotion Breakdown</p>
              <div className="summary-breakdown-bars">
                {Object.entries(summary.emotionBreakdown).map(([key, count]) => {
                  if (!count) return null;
                  const cfg = EMOTIONS.find((e) => e.key === key) ?? EMOTIONS[0];
                  const percentage = Math.round((count / totalEntries) * 100);
                  return (
                    <div key={key} className="summary-breakdown-item">
                      <div className="summary-breakdown-label">
                        <span>{cfg.emoji} {cfg.title}</span>
                        <span>{percentage}%</span>
                      </div>
                      <div className="summary-breakdown-track">
                        <div 
                           className="summary-breakdown-fill" 
                           style={{ width: `${percentage}%`, background: cfg.accent, boxShadow: `0 0 10px ${cfg.glow}` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="summary-timeline-section">
            <p className="eyebrow">Conversation Timeline</p>
            <div className="timeline-list summary-timeline">
              {summary.entries.length === 0 ? (
                <p className="empty-copy">No conversation history.</p>
              ) : (
                summary.entries.map((entry) => (
                  <article key={entry.id} className="timeline-card">
                    <div className="timeline-meta">
                      <strong>{entry.createdAt}</strong>
                      <span>{entry.emotion}</span>
                    </div>
                    <p className="timeline-text">{entry.transcript}</p>
                  </article>
                ))
              )}
            </div>
          </div>

        </div>

        <button className="summary-dismiss-btn" onClick={onDismiss}>
          Done
        </button>
      </div>
    </div>
  );
}
