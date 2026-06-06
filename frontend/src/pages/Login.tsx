import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginUser, getMe } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, gradients } from '../constants/theme'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { access_token } = await loginUser(email, password)
      // Put token in localStorage first so the axios interceptor picks it up for getMe()
      localStorage.setItem('auth_token', access_token)
      const me = await getMe()
      login(access_token, me)
      navigate('/projects')
    } catch {
      // Clear the token if getMe() failed or login failed
      localStorage.removeItem('auth_token')
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.surface2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: colors.surface,
        borderRadius: radius.card,
        padding: '40px 32px',
        boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
        border: `1px solid ${colors.line}`,
      }}>
        {/* Logo / branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            background: gradients.bluePrimary,
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '22px', fontWeight: 900 }}>S</span>
          </div>
          <h1 style={{
            margin: '0 0 6px',
            fontSize: '26px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: colors.text,
          }}>
            simple.
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: colors.muted }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: colors.text,
              marginBottom: '6px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                width: '100%',
                height: '46px',
                border: `1.5px solid ${colors.line}`,
                borderRadius: radius.btn,
                padding: '0 14px',
                fontSize: '14px',
                color: colors.text,
                background: colors.surface,
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = colors.blue)}
              onBlur={e => (e.currentTarget.style.borderColor = colors.line)}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: colors.text,
              marginBottom: '6px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%',
                height: '46px',
                border: `1.5px solid ${colors.line}`,
                borderRadius: radius.btn,
                padding: '0 14px',
                fontSize: '14px',
                color: colors.text,
                background: colors.surface,
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = colors.blue)}
              onBlur={e => (e.currentTarget.style.borderColor = colors.line)}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 14px',
              background: colors.redSoft,
              border: `1px solid ${colors.redBorder}`,
              borderRadius: radius.btn,
              color: colors.red,
              fontSize: '13px',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '50px',
              border: 'none',
              borderRadius: radius.btn,
              background: loading ? colors.mutedLight : gradients.bluePrimary,
              color: colors.surface,
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: loading ? 'none' : '0 8px 20px rgba(37,99,235,0.22)',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{
          margin: '24px 0 0',
          textAlign: 'center',
          fontSize: '14px',
          color: colors.muted,
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: colors.blue, fontWeight: 600, textDecoration: 'none' }}>
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
