"use client"

import React from 'react'

interface ErrorBoundaryProps {
    children: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <p style={{ fontSize: '3rem' }}>⚠️</p>
                    <h2 style={{ fontSize: '1.5rem' }}>Something went wrong</h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <p style={{
                        color: 'var(--danger)',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        background: 'rgba(239,68,68,0.1)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        maxWidth: 400,
                        wordBreak: 'break-all',
                    }}>
                        {this.state.error?.message || 'Unknown error'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            className="btn btn-gold"
                            onClick={() => window.location.reload()}
                        >
                            🔄 Refresh Page
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => window.location.href = '/'}
                        >
                            ← Go Home
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
