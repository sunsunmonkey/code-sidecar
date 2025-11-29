import React, { useState, useEffect } from 'react';
import type { OperationRecord } from '../types';
import './OperationHistory.css';

interface OperationHistoryProps {
  vscode: any;
}

/**
 * OperationHistory component displays the history of file operations
 * Requirements: 11.2, 11.3, 11.4, 11.5
 */
export const OperationHistory: React.FC<OperationHistoryProps> = ({ vscode }) => {
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<OperationRecord | null>(null);

  useEffect(() => {
    // Request operation history when component mounts
    vscode.postMessage({ type: 'get_operation_history' });

    // Listen for operation history updates
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'operation_history') {
        setOperations(message.operations);
      } else if (message.type === 'operation_recorded') {
        // Add new operation to the list
        setOperations(prev => [...prev, message.operation]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the operation history?')) {
      vscode.postMessage({ type: 'clear_operation_history' });
      setSelectedOperation(null);
    }
  };

  const handleOperationClick = (operation: OperationRecord) => {
    setSelectedOperation(selectedOperation?.id === operation.id ? null : operation);
  };

  const getOperationIcon = (type: string): string => {
    switch (type) {
      case 'file_write':
        return '📝';
      case 'file_edit':
        return '✏️';
      case 'file_insert':
        return '➕';
      case 'file_delete':
        return '🗑️';
      case 'command_execute':
        return '⚙️';
      default:
        return '📄';
    }
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const getOperationTypeLabel = (type: string): string => {
    switch (type) {
      case 'file_write':
        return 'Write';
      case 'file_edit':
        return 'Edit';
      case 'file_insert':
        return 'Insert';
      case 'file_delete':
        return 'Delete';
      case 'command_execute':
        return 'Execute';
      default:
        return type;
    }
  };

  if (!isExpanded) {
    return (
      <div className="operation-history-collapsed">
        <button 
          className="operation-history-toggle"
          onClick={() => setIsExpanded(true)}
          title="Show operation history"
        >
          📋 History ({operations.length})
        </button>
      </div>
    );
  }

  return (
    <div className="operation-history">
      <div className="operation-history-header">
        <h3>Operation History</h3>
        <div className="operation-history-actions">
          <button 
            className="operation-history-clear"
            onClick={handleClearHistory}
            disabled={operations.length === 0}
            title="Clear history"
          >
            Clear
          </button>
          <button 
            className="operation-history-toggle"
            onClick={() => setIsExpanded(false)}
            title="Hide operation history"
          >
            ✕
          </button>
        </div>
      </div>

      {operations.length === 0 ? (
        <div className="operation-history-empty">
          <p>No operations recorded yet.</p>
          <p className="operation-history-hint">
            File operations performed by the AI will appear here.
          </p>
        </div>
      ) : (
        <div className="operation-history-list">
          {operations.slice().reverse().map((operation) => (
            <div 
              key={operation.id}
              className={`operation-item ${selectedOperation?.id === operation.id ? 'selected' : ''}`}
              onClick={() => handleOperationClick(operation)}
            >
              <div className="operation-item-header">
                <span className="operation-icon">{getOperationIcon(operation.type)}</span>
                <span className="operation-type">{getOperationTypeLabel(operation.type)}</span>
                <span className="operation-target">{operation.target}</span>
              </div>
              
              <div className="operation-item-meta">
                <span className="operation-time">{formatTimestamp(operation.timestamp)}</span>
                <span className="operation-tool">{operation.toolName}</span>
              </div>

              {selectedOperation?.id === operation.id && (
                <div className="operation-item-details">
                  <p className="operation-description">{operation.description}</p>
                  
                  {operation.details && (
                    <div className="operation-details">
                      {operation.details.linesAdded !== undefined && (
                        <div className="operation-detail">
                          <strong>Lines added:</strong> {operation.details.linesAdded}
                        </div>
                      )}
                      {operation.details.linesRemoved !== undefined && (
                        <div className="operation-detail">
                          <strong>Lines removed:</strong> {operation.details.linesRemoved}
                        </div>
                      )}
                      {operation.details.contentPreview && (
                        <div className="operation-detail">
                          <strong>Preview:</strong>
                          <pre className="operation-preview">{operation.details.contentPreview}</pre>
                        </div>
                      )}
                      {operation.details.command && (
                        <div className="operation-detail">
                          <strong>Command:</strong>
                          <code>{operation.details.command}</code>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="operation-undo-hint">
                    💡 Use <kbd>Ctrl+Z</kbd> (or <kbd>Cmd+Z</kbd> on Mac) in the editor to undo changes
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
