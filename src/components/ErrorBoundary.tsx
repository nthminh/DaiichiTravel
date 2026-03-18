import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Language } from '../App';

interface Props {
  children: React.ReactNode;
  language?: Language;
  /** Optional label shown in the fallback header (e.g. "Payment Management") */
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const LABELS: Record<Language, { title: string; subtitle: string; retry: string; detail: string }> = {
  vi: {
    title: 'Đã xảy ra lỗi',
    subtitle: 'Trang này không thể hiển thị do có lỗi xảy ra.',
    retry: 'Thử lại',
    detail: 'Chi tiết lỗi',
  },
  en: {
    title: 'Something went wrong',
    subtitle: 'This section could not be displayed due to an error.',
    retry: 'Try again',
    detail: 'Error details',
  },
  ja: {
    title: 'エラーが発生しました',
    subtitle: 'エラーが発生したため、このセクションを表示できませんでした。',
    retry: '再試行',
    detail: 'エラーの詳細',
  },
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const lang: Language = this.props.language ?? 'vi';
    const labels = LABELS[lang];
    const { componentName } = this.props;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-lg w-full shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
          </div>

          <h2 className="text-xl font-bold text-red-700 mb-1">
            {labels.title}
            {componentName ? ` — ${componentName}` : ''}
          </h2>
          <p className="text-sm text-red-500 mb-6">{labels.subtitle}</p>

          {this.state.error && (
            <details className="mb-6 text-left">
              <summary className="text-xs font-semibold text-red-400 cursor-pointer select-none mb-1">
                {labels.detail}
              </summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw size={15} />
            {labels.retry}
          </button>
        </div>
      </div>
    );
  }
}
