# 📄 Product Requirements Document (PRD)  
### Research Assistant Application (MVP)

---

## 1. Overview  
A research assistant web application that allows **researchers** to input a query, expands it into relevant domains/topics using **Gemini API**, scrapes **Google Scholar** for research papers, processes papers with **Gemini** for insights, and provides a structured **academic-style research guide with citations**.  

---

## 2. Goals
- Provide **academic-style research guidance** with proper citations.  
- Allow **exporting/saving research guides** (PDF/Docx).  
- Deliver **chat-like user experience** for query input.  
- Scrape **Google Scholar** for **free full-text papers** where available.  
- Generate structured **summaries, comparisons, trends, and open questions**.  

---

## 3. Target Users
- Primary: **Researchers, PhD students, academics**.  
- Secondary (later): **Students, professionals exploring research**.  

---

## 4. User Flows
1. **Input Query (Chat UI)** →  
2. **Gemini expands into domains/topics/fields** →  
3. **Backend scrapes Google Scholar** (via Playwright/Patchwright) →  
4. **Collect freely available full-text PDFs** + metadata →  
5. **Gemini processes content**:  
   - Extracts key findings, comparisons, research gaps.  
   - Formats output into academic guide with **citations**.  
6. **Frontend displays results** →  
   - Option to **export/save guide**.  

---

## 5. Features  

### Core (MVP)
- Chat-like interface (Next.js).  
- Query expansion (Gemini API).  
- Scholar scraping (Playwright).  
- Paper collection (PDFs + metadata).  
- AI-based summarization & structured guide generation.  
- Export guides (PDF, DOCX).  
- User accounts (basic authentication).  
- Academic citation formatting (APA/MLA/IEEE).  

### Future Enhancements
- Add more sources (Arxiv, PubMed, Semantic Scholar, IEEE).  
- Real-time scraping updates in UI.  
- Background job queue for scaling.  
- User libraries (saved searches, bookmarks).  
- Research comparison over time (versioning).  

---

## 6. Technical Architecture  

### Frontend
- **Next.js** (React)  
- Chat-style UI for queries.  
- Auth (Google OAuth or simple login).  
- Export feature (client-side trigger, server-side generation).  

### Backend
- **Node.js / Express** (or Fastify).  
- **Playwright/Patchwright** for scraping Google Scholar.  
- **Gemini API** for:  
  - Query expansion.  
  - Summarization of abstracts & full-text PDFs.  
  - Structured research guide creation.  
- PDF parsing (e.g., `pdf-parse`, `pdfminer`).  
- File generation (e.g., `docx`, `pdfkit`).  

### Data
- **No long-term storage** for now (fetch fresh each time).  
- Temporary caching (in-memory, Redis optional later).  

### Infra
- **Local hosting** initially.  
- Option to deploy to **Vercel / AWS** in future.  
- Background jobs possible later (BullMQ/Redis).  

---

## 7. Constraints & Considerations  
- **Google Scholar scraping**: No official API, must handle CAPTCHAs, IP blocking. (Patchwright/rotating proxies may be required).  
- **Full-text papers**: Only for open-access; respect paywalls.  
- **Performance**: Query may return hundreds of papers; limit fetch (e.g., top 50).  
- **Gemini API quota**: Free tier may be limiting; optimize prompt design.  
- **Export**: Must ensure academic-style formatting.  

---

## 8. Risks
- Scholar scraping may break (fragile to UI changes).  
- Legal/ethical concerns (must avoid bypassing paywalls).  
- Performance issues if too many papers requested.  
- Costs from Gemini API scaling (if user base grows).  

---

## 9. Success Metrics
- Can generate **academic-style research guide with citations** for any query.  
- Successfully scrape and summarize at least **20–50 papers per query**.  
- Export feature works reliably (PDF/DOCX).  
- Researchers find the guide **useful for actual research direction**.  

---

## 10. Roadmap (MVP → Future)
1. **MVP**  
   - Chat UI → Gemini topic expansion → Scholar scraping → Summarization → Export.  
2. **Next Phase**  
   - Add multiple sources (Arxiv, PubMed, IEEE).  
   - Real-time scraping updates in frontend.  
   - User library + saved guides.  
3. **Scaling Phase**  
   - Background job queue.  
   - Cloud hosting.  
   - Monetization (subscriptions, academic license).  
