import React, { createContext, useContext, useState } from 'react'
import { Project } from '../api/projects'

interface ProjectContextValue {
  currentProject: Project | null
  setCurrentProject: (project: Project) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(() => {
    const stored = localStorage.getItem('current_project')
    return stored ? JSON.parse(stored) : null
  })

  const setCurrentProject = (project: Project) => {
    localStorage.setItem('current_project', JSON.stringify(project))
    setCurrentProjectState(project)
  }

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
