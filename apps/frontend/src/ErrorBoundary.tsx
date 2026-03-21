import { Component, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  errorMessage: string | null;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      errorMessage: error.message || "The frontend crashed during startup.",
    };
  }

  componentDidCatch(error: Error) {
    console.error("Frontend render failure", error);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <main className="page">
          <section className="card">
            <p className="eyebrow">Frontend Error</p>
            <h1>App failed to render</h1>
            <p className="error">{this.state.errorMessage}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
