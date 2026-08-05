import { useState, type FormEvent } from 'react'
import { login } from '../store/auth-api'
import type { AuthUser } from '../store/auth-api'
import './Login.css'

interface LoginProps {
  onLoggedIn: (user: AuthUser) => void
}

function Login({ onLoggedIn }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await login(email, password)
    setSubmitting(false)
    if (result.ok) {
      onLoggedIn(result.user)
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <h1 className="login__title">better</h1>
        <p className="login__subtitle">Sign in to your workspace</p>
        <label className="login__field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>
        <label className="login__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="login__error" role="alert">{error}</p>}
        <button type="submit" className="login__submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="login__hint">There is no sign-up — ask whoever set this up for an account.</p>
      </form>
    </div>
  )
}

export default Login
