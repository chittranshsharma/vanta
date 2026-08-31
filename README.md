# Vanta – Evidence‑Grounded Creative Intelligence

## 🚀 Product Pitch
Vanta is a premium **web‑first creative decision platform** built for growth, product‑marketing, and performance‑advertising teams. It gives you **transparent, evidence‑backed insights** to make smarter creative choices while guaranteeing that every metric, claim, or recommendation is **grounded in verifiable data**.

### Core Features
- **Evidence‑First UI** – All numbers and claims show their source, class (Observed, Sourced, Inference, Simulation, Unknown), and confidence.
- **Secure Multi‑Tenant Architecture** – Supabase Auth + PostgreSQL Row‑Level Security ensures strict data isolation.
- **Deterministic Creative Twin** – Parse scripts, calculate WPM, and generate structured scene representations without hallucinations.
- **Decision Matrix & Timeline Doctor** – Compare variant creatives side‑by‑side, see concrete edit briefs, and trace outcomes.
- **Extensible Plugin System** – Add new data connectors, AI model gateways, or simulation engines without breaking core guarantees.
- **Premium Design System** – Modern glass‑morphism, subtle micro‑animations, and a dark‑sidebar layout that feels *premium* on any laptop.

### Why Vanta?
Most AI‑assisted creative tools **invent** metrics and promise unreachable results. Vanta flips the script: it **fails‑closed** when evidence is missing, displays an “Insufficient evidence” state, and never makes unsupported claims.

## 📦 Installation Guide
1. **Prerequisites**
   - Node 20+ (`npm i -g npm@latest`)
   - A Supabase project (or local Supabase CLI)
2. **Clone & Install**
```bash
git clone https://github.com/chittranshsharma/vanta.git
cd vanta
npm install
```
3. **Configure Environment**
```bash
cp .env.example .env
# Fill in your Supabase URL and anon key (publishable only)
```
4. **Run the App**
```bash
npm run dev   # http://localhost:5173
```
5. **Production Build**
```bash
npm run build && npm run preview
```

---
*Vanta – Creative intelligence you can **trust**.*
