const API_BASE = ""

const SESSION_STORAGE_KEY = "resumeiq_session_token"

function getSessionToken(): string {
  if (typeof window === "undefined") return ""
  let token = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!token) {
    token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    window.localStorage.setItem(SESSION_STORAGE_KEY, token)
  }
  return token
}

function sessionHeaders(): Record<string, string> {
  const token = getSessionToken()
  return token ? { "X-Session-Token": token } : {}
}

function persistIssuedToken(data: unknown) {
  const token = (data as { session_token?: string } | null)?.session_token
  if (token && typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token)
  }
}

const FALLBACK_COUNTRY_RULES: Record<string, { name: string; fields: string[]; tips: string; photo: string; template: string }> = {
  us: { name: "United States", fields: [], tips: "No photo, age, marital status, religion or personal details. Lead with a keyword-rich summary.", photo: "no", template: "modern" },
  ca: { name: "Canada", fields: ["work_authorization"], tips: "Quantify achievements. No photo or personal details. Mention work authorization status if relevant.", photo: "no", template: "professional" },
  gb: { name: "United Kingdom", fields: [], tips: "Two-page CVs are common. Include a personal profile and key skills section.", photo: "no", template: "professional" },
  au: { name: "Australia", fields: [], tips: "Include a professional summary and key achievements. 'Selection criteria' style for government roles.", photo: "no", template: "executive" },
  nz: { name: "New Zealand", fields: ["work_authorization"], tips: "Keep it to 2-3 pages. Emphasise visa/work rights early if applying from abroad.", photo: "no", template: "minimal" },
  de: { name: "Germany", fields: ["date_of_birth", "nationality"], tips: "Photo optional, standard in Germany. Include date of birth, nationality and detailed skills.", photo: "optional", template: "professional" },
  fr: { name: "France", fields: [], tips: "Photo optional. Include a short 'Profil' and computer/software skills. Two-page CV is standard.", photo: "optional", template: "europass" },
  nl: { name: "Netherlands", fields: ["work_authorization"], tips: "Direct, concise. Include visa/work permission status for non-EU applicants.", photo: "optional", template: "minimal" },
  ch: { name: "Switzerland", fields: ["date_of_birth", "nationality", "work_authorization"], tips: "Photo standard. Include date of birth, nationality, languages and work permit status.", photo: "yes", template: "professional" },
  ie: { name: "Ireland", fields: ["work_authorization"], tips: "No photo. Mention EU/visa work rights if applicable.", photo: "no", template: "professional" },
  se: { name: "Sweden", fields: ["work_authorization"], tips: "Keep it factual and modest. Include languages and work permit status for non-EU applicants.", photo: "no", template: "minimal" },
  no: { name: "Norway", fields: ["nationality", "work_authorization"], tips: "Include nationality and work visa status for non-EEA applicants.", photo: "no", template: "minimal" },
  dk: { name: "Denmark", fields: ["nationality", "work_authorization"], tips: "Keep to 2 pages. Include citizenship/work permit details if applying from abroad.", photo: "no", template: "modern" },
  fi: { name: "Finland", fields: ["work_authorization"], tips: "Include language proficiency levels and residence/work permit status.", photo: "no", template: "minimal" },
  be: { name: "Belgium", fields: ["nationality"], tips: "Include languages (NL/FR/DE) and nationality. Photo optional.", photo: "optional", template: "europass" },
  lu: { name: "Luxembourg", fields: ["work_authorization"], tips: "Languages matter most (LU/FR/DE/EN). Include work permit status for non-EU.", photo: "optional", template: "europass" },
  at: { name: "Austria", fields: ["date_of_birth", "nationality"], tips: "Photo optional. Include date of birth, nationality and detailed skills.", photo: "optional", template: "professional" },
  ae: { name: "UAE", fields: ["photo", "nationality", "visa_status", "driving_license", "current_location", "notice_period"], tips: "Photo standard. Always show nationality, visa status, current location, notice period and GCC experience.", photo: "yes", template: "executive" },
  sa: { name: "Saudi Arabia", fields: ["photo", "nationality", "visa_status", "current_location", "notice_period"], tips: "Photo standard. Show nationality, visa status, current location, notice period and Saudi/GCC experience.", photo: "yes", template: "executive" },
  qa: { name: "Qatar", fields: ["photo", "nationality", "visa_status", "current_location", "notice_period"], tips: "Photo standard. Include nationality, visa status, current location and notice period.", photo: "yes", template: "executive" },
  om: { name: "Oman", fields: ["photo", "nationality", "visa_status", "notice_period"], tips: "Photo standard. Include nationality, visa status and notice period.", photo: "yes", template: "professional" },
  bh: { name: "Bahrain", fields: ["photo", "nationality", "visa_status", "notice_period"], tips: "Photo standard. Include nationality, visa status and notice period.", photo: "yes", template: "professional" },
  kw: { name: "Kuwait", fields: ["photo", "nationality", "visa_status", "notice_period"], tips: "Photo standard. Include nationality, visa status and notice period.", photo: "yes", template: "professional" },
  sg: { name: "Singapore", fields: [], tips: "No photo. Lead with a strong summary and leadership/impact statements. 2 pages acceptable.", photo: "no", template: "modern" },
  my: { name: "Malaysia", fields: ["nationality"], tips: "Photo optional. Include languages and nationality.", photo: "optional", template: "modern" },
  hk: { name: "Hong Kong", fields: ["visa_status"], tips: "Photo optional. Include Chinese + English versions, languages, and visa status.", photo: "optional", template: "modern" },
  jp: { name: "Japan", fields: ["photo", "date_of_birth", "nationality", "visa_status"], tips: "Photo standard. Include date of birth, nationality, visa status and Japanese language level.", photo: "yes", template: "professional" },
  kr: { name: "South Korea", fields: ["photo", "date_of_birth", "nationality"], tips: "Photo standard. Include date of birth, nationality and Korean language level.", photo: "yes", template: "professional" },
  in: { name: "India", fields: ["current_location", "notice_period"], tips: "Photo optional. Mention current location, notice period and work authorization for foreign roles.", photo: "optional", template: "professional" },
}

export async function uploadResume(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/api/v1/resume/upload`, {
    method: "POST",
    headers: sessionHeaders(),
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  persistIssuedToken(data)
  return data
}

export async function pasteResume(text: string) {
  const formData = new FormData()
  formData.append("text", text)
  formData.append("filename", "pasted_resume.txt")
  const res = await fetch(`${API_BASE}/api/v1/resume/paste`, {
    method: "POST",
    headers: sessionHeaders(),
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  persistIssuedToken(data)
  return data
}

export async function analyzeResume(resumeId: number) {
  const res = await fetch(`${API_BASE}/api/v1/analyze/${resumeId}`, {
    method: "POST",
    headers: sessionHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getResume(resumeId: number) {
  const res = await fetch(`${API_BASE}/api/v1/resume/${resumeId}`, { headers: sessionHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAnalysis(resumeId: number) {
  const res = await fetch(`${API_BASE}/api/v1/analyze/${resumeId}`, { headers: sessionHeaders() })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(await res.text())
  }
  return res.json()
}

export async function listResumes() {
  const res = await fetch(`${API_BASE}/api/v1/resume/`, { headers: sessionHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listAnalyses() {
  const res = await fetch(`${API_BASE}/api/v1/analyze/`, { headers: sessionHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function matchJD(resumeId: number, jdText: string, jdTitle?: string, jdCompany?: string) {
  const res = await fetch(`${API_BASE}/api/v1/jd-match/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ jd_text: jdText, jd_title: jdTitle, jd_company: jdCompany }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getRewriteSuggestions(resumeId: number, jdText?: string) {
  const res = await fetch(`${API_BASE}/api/v1/rewrite/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ jd_text: jdText }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getInterviewQuestions(resumeId: number, jdText?: string) {
  const res = await fetch(`${API_BASE}/api/v1/interview/questions/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ jd_text: jdText }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getInterviewQuestionsFromText(resumeText: string, jdText?: string) {
  const res = await fetch(`${API_BASE}/api/v1/interview/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function trackVisitor(path: string) {
  try {
    await fetch(`${API_BASE}/api/v1/visitor/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, user_agent: navigator.userAgent }),
    })
  } catch {}
}

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error("Invalid credentials")
  return res.json()
}

export async function getAdminStats(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAdminFinancials(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/financials`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function submitContact(data: { name: string; email: string; company?: string; subject?: string; message: string }) {
  const res = await fetch(`${API_BASE}/api/v1/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getContactMessages(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/contact`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteContactMessage(token: string, id: number) {
  const res = await fetch(`${API_BASE}/api/v1/admin/contact/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getPaymentConfig() {
  const res = await fetch(`${API_BASE}/api/v1/payment/config`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createCheckoutSession(plan: string, email: string, currency = "INR") {
  const res = await fetch(`${API_BASE}/api/v1/payment/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, email, currency }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSubscription(email: string) {
  const res = await fetch(`${API_BASE}/api/v1/payment/subscription?email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createPortalSession(email: string) {
  const res = await fetch(`${API_BASE}/api/v1/payment/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function generateCoverLetter(params: {
  resume_id: number
  jd_text: string
  jd_title?: string
  company_name?: string
  tone?: string
  length?: string
}) {
  const res = await fetch(`${API_BASE}/api/v1/cover-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAIStatus() {
  const res = await fetch(`${API_BASE}/api/v1/ai/status`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function aiPost(path: string, resumeId: number, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${API_BASE}${path}/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(extra),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function aiAchievements(resumeId: number, jdText?: string) {
  return aiPost("/api/v1/ai/achievements", resumeId, { jd_text: jdText })
}
export function aiSummary(resumeId: number, jdText?: string) {
  return aiPost("/api/v1/ai/summary", resumeId, { jd_text: jdText })
}
export function aiSkills(resumeId: number, jdText?: string) {
  return aiPost("/api/v1/ai/skills", resumeId, { jd_text: jdText })
}
export function aiImprove(resumeId: number, jdText?: string) {
  return aiPost("/api/v1/ai/improve", resumeId, { jd_text: jdText })
}
export function aiLinkedin(resumeId: number, jdText?: string) {
  return aiPost("/api/v1/ai/linkedin", resumeId, { jd_text: jdText })
}

export async function getCountries() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/countries`)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  } catch {
    return { countries: Object.entries(FALLBACK_COUNTRY_RULES).map(([code, r]) => ({ code, name: r.name, fields: r.fields })) }
  }
}

export async function getCountry(code: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/countries/${encodeURIComponent(code)}`)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  } catch {
    const r = FALLBACK_COUNTRY_RULES[code] || FALLBACK_COUNTRY_RULES.us
    return {
      country: {
        ...r,
        code: FALLBACK_COUNTRY_RULES[code] ? code : "us",
        format: "Reverse chronological, ATS-friendly",
        page_limit: "1-2 pages",
        sections: ["summary", "skills", "experience", "certifications", "education", "languages"],
      },
    }
  }
}

export async function exportResume(params: {
  format: string
  country?: string
  template?: string
  resume_id?: number
  parsed_json?: Record<string, unknown>
}) {
  const res = await fetch(`${API_BASE}/api/v1/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const disposition = res.headers.get("content-disposition") || ""
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : "resume"
  return { blob, filename }
}
