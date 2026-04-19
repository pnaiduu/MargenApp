import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', error, info.componentStack)
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-lg px-4 py-6 alert-error">
          <p className="text-sm font-semibold">Something went wrong</p>
          <p className="mt-2 text-sm">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-4 rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
