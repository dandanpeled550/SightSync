import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProjects, createProject, type Project, type CreateProjectPayload } from '../api/projects'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, gradients } from '../constants/theme'

const emptyForm: CreateProjectPayload = {
  name: '',
  location_city: '',
  latitude: 0,
  longitude: 0,
}

export default function ProjectSelect() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateProjectPayload>(emptyForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const { setCurrentProject } = useProject()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchProjects()
      .then(list => setProjects(Array.isArray(list) ? list : []))
      .catch(() => setError('Failed to load projects.'))
      .finally(() => setLoading(false))
  }, [])

  function handleSelect(project: Project) {
    setCurrentProject(project)
    navigate('/')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.location_city.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const newProject = await createProject(form)
      setProjects(prev => [...prev, newProject])
      setShowForm(false)
      setForm(emptyForm)
      // Auto-select the newly created project
      handleSelect(newProject)
    } catch {
      setCreateError('Failed to create project. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '44px',
    border: `1.5px solid ${colors.line}`,
    borderRadius: radius.btn,
    padding: '0 14px',
    fontSize: '14px',
    color: colors.text,
    background: colors.surface,
    boxSizing: 'border-box',
    outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.surface2,
    }}>
      {/* Top bar */}
      <div style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.line}`,
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.03em', color: colors.text }}>
          simple.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <span style={{ fontSize: '13px', color: colors.muted }}>
              {user.name}
            </span>
          )}
          <button
            onClick={logout}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: `1.5px solid ${colors.line}`,
              borderRadius: radius.btn,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.muted,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{
        maxWidth: '520px',
        margin: '0 auto',
        padding: '40px 24px',
      }}>
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{
            margin: '0 0 6px',
            fontSize: '24px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: colors.text,
          }}>
            Your projects
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: colors.muted }}>
            Select a project to continue or create a new one.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2].map(i => (
              <div
                key={i}
                className="shimmer"
                style={{ height: '80px', borderRadius: radius.card }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            padding: '14px 16px',
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            borderRadius: radius.card,
            color: colors.red,
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && !showForm && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 20px',
            gap: '16px',
            textAlign: 'center',
            background: colors.surface,
            borderRadius: radius.card,
            border: `1px solid ${colors.line}`,
            marginBottom: '16px',
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: colors.blueSoft,
              display: 'grid',
              placeItems: 'center',
              fontSize: '32px',
            }}>
              🏗
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text, marginBottom: '6px' }}>
                No projects yet
              </div>
              <div style={{ fontSize: '14px', color: colors.muted }}>
                Create your first project to get started.
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: '13px 28px',
                background: gradients.bluePrimary,
                color: colors.surface,
                border: 'none',
                borderRadius: radius.btn,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(37,99,235,0.22)',
              }}
            >
              Create your first project
            </button>
          </div>
        )}

        {/* Project list */}
        {!loading && !error && projects.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '18px 20px',
                  background: colors.surface,
                  border: `1.5px solid ${colors.line}`,
                  borderRadius: radius.card,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = colors.blue
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.10)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = colors.line
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: colors.blueSoft,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                }}>
                  🏗
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: colors.text,
                    letterSpacing: '-0.02em',
                    marginBottom: '2px',
                  }}>
                    {project.name}
                  </div>
                  <div style={{ fontSize: '13px', color: colors.muted }}>
                    {project.location_city}
                  </div>
                </div>
                <span style={{ fontSize: '20px', color: colors.mutedLight }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* New project button */}
        {!loading && projects.length > 0 && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '14px',
              background: 'transparent',
              border: `1.5px dashed ${colors.line}`,
              borderRadius: radius.card,
              fontSize: '14px',
              fontWeight: 600,
              color: colors.muted,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = colors.blue
              e.currentTarget.style.color = colors.blue
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = colors.line
              e.currentTarget.style.color = colors.muted
            }}
          >
            + New project
          </button>
        )}

        {/* Create project form */}
        {showForm && (
          <div style={{
            background: colors.surface,
            border: `1.5px solid ${colors.blue}`,
            borderRadius: radius.card,
            padding: '24px',
            boxShadow: '0 4px 16px rgba(37,99,235,0.10)',
          }}>
            <h3 style={{
              margin: '0 0 20px',
              fontSize: '16px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: colors.text,
            }}>
              New project
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: '6px' }}>
                  Project name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Downtown Office Build"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: '6px' }}>
                  City *
                </label>
                <input
                  type="text"
                  value={form.location_city}
                  onChange={e => setForm(f => ({ ...f, location_city: e.target.value }))}
                  required
                  placeholder="Tel Aviv"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: '6px' }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude || ''}
                    onChange={e => setForm(f => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                    placeholder="32.0853"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: '6px' }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude || ''}
                    onChange={e => setForm(f => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                    placeholder="34.7818"
                    style={inputStyle}
                  />
                </div>
              </div>

              {createError && (
                <div style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  background: colors.redSoft,
                  border: `1px solid ${colors.redBorder}`,
                  borderRadius: radius.btn,
                  color: colors.red,
                  fontSize: '13px',
                }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(emptyForm); setCreateError(null) }}
                  style={{
                    flex: '0 0 auto',
                    padding: '12px 18px',
                    background: colors.surface2,
                    border: `1.5px solid ${colors.line}`,
                    borderRadius: radius.btn,
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.muted,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 1,
                    padding: '12px 18px',
                    background: creating ? colors.mutedLight : gradients.bluePrimary,
                    border: 'none',
                    borderRadius: radius.btn,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: colors.surface,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    boxShadow: creating ? 'none' : '0 6px 16px rgba(37,99,235,0.2)',
                  }}
                >
                  {creating ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
