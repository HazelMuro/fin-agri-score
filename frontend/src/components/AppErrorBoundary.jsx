import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    // Keep visible log for debugging without blank-screen crashes.
    // eslint-disable-next-line no-console
    console.error('UI crash caught by AppErrorBoundary:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="card">
            <h2>Something went wrong</h2>
            <p className="text-muted">
              The screen crashed unexpectedly. Your data is still in the backend.
              Please reload and continue.
            </p>
            <div className="alert alert-danger mb-4">
              {this.state.error?.message || 'Unexpected rendering error'}
            </div>
            <button className="btn" onClick={this.handleReload}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

