import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an unexpected error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50" dir="rtl">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-3xl shadow-xl p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-black text-gray-900">نعتذر، حدث خطأ غير متوقع</h2>
            <p className="text-sm text-gray-500 font-medium">
              حدث خلل أثناء عرض هذه الصفحة. يمكنك المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold transition-colors"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
              >
                تحديث الصفحة
              </button>
              <button
                onClick={this.handleHome}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-colors"
              >
                الرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
