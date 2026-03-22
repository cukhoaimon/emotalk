import { AnalysisResponse } from "../lib/api";
import { TranscriptEntry } from "../lib/types";

interface LiveResponsePanelProps {
  analysisResult: AnalysisResponse | null;
  transcriptEntries: TranscriptEntry[];
  isAnalyzing: boolean;
  liveStatus: string;
}

export function LiveResponsePanel({ analysisResult, transcriptEntries, isAnalyzing, liveStatus }: LiveResponsePanelProps) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Response</p>
            <h2 style={{ margin: "4px 0 0", fontSize: "0.95rem", fontWeight: 500 }}>Avatar Reply</h2>
          </div>
          <span className="tile-badge active">{isAnalyzing ? "Responding" : liveStatus}</span>
        </div>
        {analysisResult ? (
          <div className="stack-panel">
            <article className="analysis-card">
              <p className="eyebrow">Transcript</p>
              <p className="transcript">{analysisResult.transcript}</p>
            </article>
            <article className="analysis-card">
              <p className="eyebrow">{analysisResult.emotion}</p>
              <p className="analysis-response">{analysisResult.reply}</p>
            </article>
          </div>
        ) : (
          <p className="empty-copy">Start speaking after joining — your avatar will reply here.</p>
        )}
      </div>
      <div>
        <div className="panel-header">
          <div>
            <p className="eyebrow">History</p>
            <h2 style={{ margin: "4px 0 0", fontSize: "0.95rem", fontWeight: 500 }}>Conversation</h2>
          </div>
        </div>
        <div className="timeline-list">
          {transcriptEntries.length === 0 ? (
            <p className="empty-copy">No conversation history yet.</p>
          ) : (
            transcriptEntries.map((entry) => (
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
    </>
  );
}
