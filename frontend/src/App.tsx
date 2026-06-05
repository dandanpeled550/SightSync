import { useEffect, useState } from 'react'
import api from './api/client'

function App() {
  const [status, setStatus] = useState<string>('checking...')

  useEffect(() => {
    api.get('/health')
      .then(res => setStatus(res.data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>SightSync</h1>
      <p>API status: <strong>{status}</strong></p>
    </div>
  )
}

export default App
