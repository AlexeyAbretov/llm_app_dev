import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-8 text-center"
          role="alert"
        >
          <h2 className="mb-2 text-lg font-semibold text-red-800">Что-то пошло не так</h2>
          <p className="mb-4 text-red-700">
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Обновить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
