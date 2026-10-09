<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Game logic lives in `src/game/sim.ts` as plain mutable state stepped from one `useFrame`; React components only render and sync refs — avoids per-frame React re-renders.
- The game route is `ssr: false` because WebGL, canvas textures and pointer lock are browser-only.
- Cars and pedestrians use CC0 Kenney GLBs from `public/models/` (external `Textures/colormap.png` must sit beside them), loaded in `src/game/RealModels.tsx`; Keke stays procedural because no CC0 tricycle exists in the kit.
- Buildings carry a `kind` (bank/office/hotel/residential/cafe/restaurant/shop/heritage) assigned in `world.ts` with its own seeded RNG, rendered per facade family in `src/game/Buildings.tsx` — keeps street layout stable while typology changes.
- Danfo, BRT, Keke and Okada are procedural with canvas liveries in `src/game/Vehicles.tsx`; sedans/police stay Kenney GLBs — no CC0 models exist for Lagos transport.
