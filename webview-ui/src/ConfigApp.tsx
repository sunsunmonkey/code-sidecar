/**
 * ConfigApp component
 * Root component for the configuration interface
 * Requirements: 1.1
 */

import { ConfigPanel } from './components/config/ConfigPanel';
import './App.css';

/**
 * ConfigApp component
 * Entry point for the configuration webview application
 */
function ConfigApp() {
  /**
   * Navigate back to main page
   */
  const navigateBack = () => {
    window.location.hash = '#/';
  };

  return (
    <div className="app-container">
      <div className="config-header">
        <button 
          className="back-button"
          onClick={navigateBack}
          title="Back to Chat"
        >
          ← Back
        </button>
        <h2>Configuration</h2>
      </div>
      <ConfigPanel />
    </div>
  );
}

export default ConfigApp;
