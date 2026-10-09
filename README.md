# Lagos Drive

Create a 3D open-world action game set in a stylized, retro low-poly Lagos, playable in the browser using Three.js / React Three Fiber.

Key Features & Setting:

1. Environment & Atmosphere:

   - A vibrant low-poly Lagos cityscape featuring wide multi-lane roads (inspired by the Third Mainland Bridge / Marina expressway), overpasses, roadside market stalls, palm trees, and coastal water.

   - Distinctive local traffic: iconic yellow 'Danfo' commercial minibuses with dual black stripes, green/yellow Keke Napep tricycles, and civilian sedans.

   - Bright coastal daylight with warm haze and colorful billboard signage.

2. Player Controls & Perspective:

   - On-foot first-person controls using the Pointer Lock API (mouse to look, WASD to move, Shift to sprint, Space to jump).

   - Smooth head-bob and interaction reticle in the center of the screen.

   - Press 'F' or 'E' near any vehicle to enter/hijack it.

   - In-vehicle view: cockpit/dashboard camera or snappy close-chase camera with arcade driving physics (acceleration, responsive steering, drifting, and collision detection).

3. Gameplay Mechanics:

   - Wanted Level / Heat System: 1 to 5 star police alert system triggered by reckless driving or hitting pedestrians/vehicles. Police cruisers spawn and pursue when heat rises.

   - City Life: Simple wandering pedestrian AI on sidewalks and moving traffic along marked road waypoints.

   - Missions / Quick Jobs: Basic courier/drop-off tasks or taxi fares picking up passengers across the map for cash.

4. UI & Audio:

   - Retro GTA-style HUD: circular radar minimap at the bottom-left showing player position and mission markers.

   - Health bar, stamina meter, current vehicle speed, and cash counter at the top right.

   - In-game radio toggle with upbeat Afrobeat/synth tracks and local sound effects (car horns, engine revs, sirens).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0b83341e-66b0-452d-942c-75ad3d60ae7c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
