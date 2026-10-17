# Board Night

An online property-trading board game in the style of [richup.io](https://richup.io), played in the
browser with friends. Create a room, send the link, and play. No accounts, no downloads, no ads.

It runs on Cloudflare's free tier: a Worker with one Durable Object per room holds the authoritative
game, a pure TypeScript rules engine decides everything, and a React client renders it.

## Running it

Requires Node 18+.

```sh
npm install
npm run build:client   # build the client into dist/client
npm run dev            # Worker + client on http://localhost:8787
```

For client work with live reload, also run `npx vite` and open http://localhost:5173 (it proxies the
API to 8787). Without a server at all, `http://localhost:5173/?dev=sim&auto=1` runs a full game of
bots in the page.

```sh
npm test               # unit tests
npm run check          # type check
```

Deploy with `npx wrangler deploy` after building the client, then run `npm run smoke` against
production.

## How to play

2–8 players each start with $1500 and take turns rolling two dice and moving round the board.

- **Buy** any unowned city, airport or company you land on, or pass and leave it on the market.
- **Rent** is collected automatically when someone lands on your property. Airports pay more the more
  you own; companies charge a multiple of the dice.
- **Build** houses (up to four, then a hotel) once you own every city of a country, evenly across the
  country. Rent climbs steeply with each one. The bank has 32 houses and 12 hotels.
- **START** pays $200 when you pass it and $300 if you land on it.
- **Surprise** and **Treasure** tiles draw a card; **Earnings Tax** takes 10% of your net worth and
  **Premium Tax** a flat $75.
- **Prison:** three doubles in a row, a card or the "Go to prison" corner puts you there. Get out by
  rolling doubles, using a pardon card, or paying $50 (which ends your turn). After three turns you pay
  and move.
- **Vacation** costs you your next turn (and, with Vacation cash on, pays out the pot of taxes and
  fees).
- **Trade** cash, properties and pardon cards with anyone, at any time.
- **Debt:** if you can't pay, your balance goes negative and the game waits while you sell buildings
  or property, or trade. Sell back to the bank for half price. If you can't recover, declare
  bankruptcy; everything you own goes back to the bank.
- **Win** by being the last player standing.

The host can change the starting cash, player limit, START salary, prison fee and several rule
toggles (even build, random turn order, Vacation cash, no rent in prison, unlimited buildings,
anti-collusion) in the lobby. Full rules are in [docs/ENGINE.md](docs/ENGINE.md).

## Boards

| Board | Tiles | Character |
|---|---|---|
| Classic | 40 | The familiar layout: eight countries of two or three cities |
| Mr. Worldwide | 48 | A bigger board with ten countries, two of them four cities long, and three companies |
| Death Valley | 40 | Four huge countries of five and six cities |
| Lucky Wheel | 40 | Eight pairs of cities, no companies, and sixteen card and tax tiles |

## Documentation

| Where | What |
|---|---|
| [docs/PROJECT.md](docs/PROJECT.md) | Product decisions, principles, IP rules, terminology, commands, history |
| [docs/ENGINE.md](docs/ENGINE.md) | The rules engine and every rule as implemented, with the decisions behind them |
| [docs/SERVER.md](docs/SERVER.md) | The Worker and room Durable Object, protocol, lobby, persistence, deployment |
| [docs/CLIENT.md](docs/CLIENT.md) | The React app: screens, board, playback queue, animation, assets, dev tools |
| [docs/DATA.md](docs/DATA.md) | The four maps and the two card decks |
| [docs/SHARED.md](docs/SHARED.md) | The shared type contract |
| [research/](research/README.md) | What we observed of richup.io and the official rules, with sources |
