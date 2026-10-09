import { createFileRoute } from "@tanstack/react-router";
import { Game } from "../game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Eko Run — Low-Poly Lagos Open-World Game" },
      { name: "description", content: "Drive Danfos and Kekes, run courier jobs and taxi fares, and dodge the police in a retro low-poly Lagos, right in your browser." },
      { property: "og:title", content: "Eko Run — Low-Poly Lagos Open-World Game" },
      { property: "og:description", content: "A retro 3D open-world action game set in Lagos. Hijack a Danfo, earn naira, outrun the heat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
