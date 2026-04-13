# I Have To Poop

Emergency restroom finder with one giant red button, urgency-aware ranking, and smart routing.

## What this build does
- One big red button home screen
- Browser geolocation
- Smart mode based on movement speed
- Live Google Places nearby search when your API key is present
- Safe demo fallback when live search is unavailable
- Google Maps directions handoff

## 1. Install
```bash
npm install
```

## 2. Add your API key
Create a file named `.env.local` in the project root:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_real_key_here
```

## 3. Run locally
```bash
npm run dev
```

Then open `http://localhost:3000`

## 4. Deploy to Vercel
- Push this folder to GitHub
- Import the repo into Vercel
- Add environment variable:
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Redeploy

## 5. Google Cloud setup
- Enable billing
- Enable Places API
- Restrict your key to:
  - Places API only
  - allowed website origins, such as:
    - `http://localhost:3000/*`
    - `https://your-app-name.vercel.app/*`

## Notes
This build uses the Places API directly from the browser so it stays simple for MVP deployment.
Restrict the API key by HTTP referrer before sharing publicly.
