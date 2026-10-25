/**
 * Treasure deck (our Community Chest equivalent) — windfalls, refunds, small
 * civic payouts. Card count, effect types and dollar amounts are structurally
 * modeled on the official 16-card Community Chest deck catalogued in
 * `research/cards.md` (mechanics are not protectable — see docs/PROJECT.md, "IP"), but
 * every `text` string here is original prose written for our travel theme.
 * No Hasbro proper nouns or card wording appear anywhere below.
 *
 * Map-safety note: the only `move_to` card targets tileIndex 0 (START), which
 * exists on every map. No card in this deck is Classic-index-
 * dependent.
 */

import type { Card } from '../../shared/types';

export const treasureCards: Card[] = [
  {
    id: 'treasure-01',
    deck: 'treasure',
    text: 'A missed connection sends you straight back to the terminal. Move to START and collect your START salary.',
    effect: { kind: 'move_to', tileIndex: 0, collectStart: true },
  },
  {
    id: 'treasure-02',
    deck: 'treasure',
    text: 'The currency exchange booth overcharged you last season and just noticed. They make it right. Collect $200.',
    effect: { kind: 'money', amount: 200 },
  },
  {
    id: 'treasure-03',
    deck: 'treasure',
    text: "A clinic visit abroad isn't covered by your travel plan. Pay $50.",
    effect: { kind: 'money', amount: -50 },
  },
  {
    id: 'treasure-04',
    deck: 'treasure',
    text: 'Shares in a little souvenir stand you backed years ago finally pay a dividend. Collect $50.',
    effect: { kind: 'money', amount: 50 },
  },
  {
    id: 'treasure-05',
    deck: 'treasure',
    text: 'A local fixer slips you a note that talks any official into letting you go. Keep it until you need it to leave Prison.',
    effect: { kind: 'pardon' },
  },
  {
    id: 'treasure-06',
    deck: 'treasure',
    text: "Your passport photo doesn't match your face anymore, and now you're explaining yourself to a very serious official. You are sent straight to Prison.",
    effect: { kind: 'go_to_jail' },
  },
  {
    id: 'treasure-07',
    deck: 'treasure',
    text: 'The travel co-op fund you paid into for years finally matures. Collect $100.',
    effect: { kind: 'money', amount: 100 },
  },
  {
    id: 'treasure-08',
    deck: 'treasure',
    text: 'A departure levy you should never have paid gets refunded at the border. Collect $20.',
    effect: { kind: 'money', amount: 20 },
  },
  {
    id: 'treasure-09',
    deck: 'treasure',
    text: "Word gets around that it's your birthday, and every traveler you've met on the road chips in. Collect $10 from every other player.",
    effect: { kind: 'money_from_each', amount: 10 },
  },
  {
    id: 'treasure-10',
    deck: 'treasure',
    text: 'An old travel-insurance policy you forgot about finally pays out. Collect $100.',
    effect: { kind: 'money', amount: 100 },
  },
  {
    id: 'treasure-11',
    deck: 'treasure',
    text: 'An emergency room bill arrives, and your coverage does not extend this far from home. Pay $100.',
    effect: { kind: 'money', amount: -100 },
  },
  {
    id: 'treasure-12',
    deck: 'treasure',
    text: 'Back tuition comes due on that language course you never quite finished paying off. Pay $50.',
    effect: { kind: 'money', amount: -50 },
  },
  {
    id: 'treasure-13',
    deck: 'treasure',
    text: 'A tourist board pays you a small fee for a glowing write-up of the area. Collect $25.',
    effect: { kind: 'money', amount: 25 },
  },
  {
    id: 'treasure-14',
    deck: 'treasure',
    text: 'A regional council bills every landlord in the district for storm damage repairs. Pay $40 per house and $115 per hotel you own.',
    effect: { kind: 'repairs', perHouse: 40, perHotel: 115 },
  },
  {
    id: 'treasure-15',
    deck: 'treasure',
    text: 'You take runner-up in a local photo contest, prize money included. Collect $10.',
    effect: { kind: 'money', amount: 10 },
  },
  {
    id: 'treasure-16',
    deck: 'treasure',
    text: 'A distant relative you barely remember leaves you a small inheritance. Collect $100.',
    effect: { kind: 'money', amount: 100 },
  },
];
