import { Icon } from './ui/Icon'
import { Button } from './ui/Button'
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-dvh flex items-center justify-center bg-shell p-4">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <Icon name="alert" size={28} className="text-danger" />
            <div>
              <p className="text-sm font-medium text-fg">Algo salió mal</p>
              <p className="text-xs text-fg-faint mt-1">
                {import.meta.env.DEV
                  ? this.state.error?.message || 'Error inesperado al cargar la aplicación'
                  : 'Error inesperado al cargar la aplicación. Intenta de nuevo.'}
              </p>
            </div>
            <Button onClick={this.handleReset}>Reintentar</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
