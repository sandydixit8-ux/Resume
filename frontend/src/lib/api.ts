const API_BASE = ""

export async function uploadResume(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/api/v1/resume/upload`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function pasteResume(text: string) {
  const formData = new FormData()
  formData.append("text", text)
  formData.append("filename", "pasted_resume.txt")
  const res = await fetch(`${API_BASE}/api/v1/resume/paste`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function analyzeResume(resumeId: number) {
  const res = await fetch(`${API_BASE}/api/v1/analyze/${resumeId}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getResume(resumeId: number) {
  const res = await fetch(`${API_BASE}/api/v1/resume/${resumeId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAnalysis(resumeId: number) {
  const res = await fetch(`${API_BASE}/api/v1/analyze/${resumeId}`)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(await res.text())
  }
  return res.json()
}

export async function matchJD(resumeId: number, jdText: string, jdTitle?: string, jdCompany?: string) {
  const res = await fetch(`${API_BASE}/api/v1/jd-match/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText, jd_title: jdTitle, jd_company: jdCompany }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getRewriteSuggestions(resumeId: number, jdText?: string) {
  const res = await fetch(`${API_BASE}/api/v1/rewrite/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getInterviewQuestions(resumeId: number, jdText?: string) {
  const res = await fetch(`${API_BASE}/api/v1/interview/questions/${resumeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function getPaymentConfig() {
  const res = await fetch(`${API_BASE}/api/v1/payment/config`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createCheckoutSession(plan: string, email: string) {
  const res = await fetch(`${API_BASE}/api/v1/payment/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, email }),
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
