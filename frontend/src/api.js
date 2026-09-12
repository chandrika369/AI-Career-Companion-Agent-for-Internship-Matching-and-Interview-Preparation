import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach token on every request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// ── Auth ──────────────────────────────────────────────────────────────
export const register = (data) => api.post('/users/register', data)
export const login = (email, password) => {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  return api.post('/users/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
}
export const getProfile = () => api.get('/users/profile')
export const updateProfile = (data) => api.put('/users/profile', data)
export const changePassword = (data) => api.post('/users/change-password', data)
export const logout = () => api.post('/users/logout')

// ── Resume ────────────────────────────────────────────────────────────
export const uploadResume = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/resume/upload', fd)
}

// ── Internships ───────────────────────────────────────────────────────
export const browseInternships = (params) => api.get('/internships/', { params })
export const getInternship = (id) => api.get(`/internships/${id}`)
export const matchInternships = (resume_data, top_k = 10) =>
  api.post('/internships/match', { resume_data, top_k })
export const generateCoverLetter = (payload) => api.post('/internships/cover-letter', payload)
export const skillGapAnalysis = (payload) => api.post('/internships/skill-gap', payload)
export const applyToInternship = (payload) => api.post('/internships/apply', payload)
export const getMyApplications = () => api.get('/internships/applications/me')
export const updateApplicationStatus = (id, status) => api.patch(`/internships/applications/${id}/status`, { status })
export const withdrawApplication = (id) => api.delete(`/internships/applications/${id}`)

// ── Chat / Interview Prep ─────────────────────────────────────────────
export const sendChatMessage = (payload) => api.post('/chat/message', payload)
export const documentQA = (payload) => api.post('/chat/document-qa', payload)
export const extractDocument = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/chat/extract-document', fd)
}

// ── Chat Sessions ─────────────────────────────────────────────────────
export const createChatSession = (payload) => api.post('/chat/sessions', payload)
export const listChatSessions = () => api.get('/chat/sessions')
export const getChatSession = (id) => api.get(`/chat/sessions/${id}`)
export const renameChatSession = (id, title) => api.patch(`/chat/sessions/${id}`, { title })
export const deleteChatSession = (id) => api.delete(`/chat/sessions/${id}`)

export default api
