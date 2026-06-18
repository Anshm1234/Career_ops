export type RankedJob = {
  id: string
  title: string
  company: string
  source: "greenhouse" | "lever" | "ashby" | "workday"
  location: string
  salary: string
  posted: string
  score: number
  status: "applied" | "queued" | "review"
  keywords: string[]
  dimensions: { skill: number; salary: number; role: number; location: number; seniority: number }
}

export const RANKED_JOBS: RankedJob[] = [
  {
    id: "1",
    title: "Machine Learning Engineer",
    company: "Anthropic",
    source: "greenhouse",
    location: "Remote · US",
    salary: "₹1.4Cr – ₹1.9Cr",
    posted: "2d ago",
    score: 0.94,
    status: "applied",
    keywords: ["python", "pytorch", "machine learning", "llm"],
    dimensions: { skill: 0.92, salary: 0.6, role: 1, location: 1, seniority: 1 },
  },
  {
    id: "2",
    title: "AI Research Engineer",
    company: "Mistral",
    source: "ashby",
    location: "Paris · Hybrid",
    salary: "₹95L – ₹1.3Cr",
    posted: "1d ago",
    score: 0.89,
    status: "queued",
    keywords: ["pytorch", "transformers", "research"],
    dimensions: { skill: 0.88, salary: 0.7, role: 0.9, location: 0.6, seniority: 1 },
  },
  {
    id: "3",
    title: "Senior Backend Engineer",
    company: "Stripe",
    source: "greenhouse",
    location: "Bangalore · Onsite",
    salary: "₹60L – ₹85L",
    posted: "4h ago",
    score: 0.86,
    status: "review",
    keywords: ["python", "fastapi", "aws", "distributed systems"],
    dimensions: { skill: 0.81, salary: 0.9, role: 0.7, location: 1, seniority: 0.9 },
  },
  {
    id: "4",
    title: "ML Platform Engineer",
    company: "Cursor",
    source: "ashby",
    location: "Remote",
    salary: "₹1.1Cr – ₹1.5Cr",
    posted: "3d ago",
    score: 0.83,
    status: "queued",
    keywords: ["python", "ml ops", "kubernetes"],
    dimensions: { skill: 0.79, salary: 0.65, role: 0.85, location: 1, seniority: 0.8 },
  },
  {
    id: "5",
    title: "Data Scientist",
    company: "Spotify",
    source: "lever",
    location: "Remote · EU",
    salary: "₹70L – ₹95L",
    posted: "5d ago",
    score: 0.78,
    status: "review",
    keywords: ["python", "machine learning", "sql"],
    dimensions: { skill: 0.74, salary: 0.8, role: 0.6, location: 0.9, seniority: 0.85 },
  },
  {
    id: "6",
    title: "Applied Scientist, Search",
    company: "Perplexity",
    source: "ashby",
    location: "San Francisco · Onsite",
    salary: "₹1.3Cr – ₹1.7Cr",
    posted: "6h ago",
    score: 0.75,
    status: "queued",
    keywords: ["nlp", "pytorch", "retrieval"],
    dimensions: { skill: 0.83, salary: 0.55, role: 0.8, location: 0.4, seniority: 0.9 },
  },
]
