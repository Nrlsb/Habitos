import React from 'react'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 max-w-sm">
                        <p className="text-red-400 font-semibold text-lg mb-2">Algo salió mal</p>
                        <p className="text-slate-400 text-sm mb-6">
                            {this.state.error?.message || 'Error inesperado en esta sección.'}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-medium transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

export default ErrorBoundary
