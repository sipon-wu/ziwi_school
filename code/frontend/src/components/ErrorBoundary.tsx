/** 全局 React 错误边界 */
import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">页面异常</h2>
            <p className="text-sm text-gray-500 mb-2">应用遇到了意外错误，请刷新页面重试</p>
            {this.state.error && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A3A6B] text-white rounded-xl shadow-sm hover:bg-[#2B5DA8]">
              <RefreshCw size={15} /> 刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
