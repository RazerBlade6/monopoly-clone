/**
 * Surprise deck (our Chance equivalent) — movement, sudden costs, chaos.
 * Card count and effect-type distribution are structurally modeled on the
 * official 16-card Chance deck catalogued in `research/cards.md` (mechanics
 * are not protectable — see docs/PROJECT.md, "IP"), but every `text` string here is
 * original prose written for our travel theme. No Hasbro proper nouns or
 * card wording appear anywhere below.
 *
 * Map-safety note: three official Chance cards ("Advance to Boardwalk",
 * "Advance to Illinois Avenue", "Advance to St. Charles Place") move to a
 * fixed absolute tile that only exists on the Classic map — that index isn't
 * safe across our four maps, so instead of reproducing them we swap in three
 * `move_relative` "reroute" cards below. The only `move_to` card in this deck
 * targets tileIndex 0 (START), which exists on every map.
 * No card in this deck is Classic-index-dependent.
 */

import type { Card } from '../../shared/types';

export const surpriseCards: Card[] = [
  {
    id: 'surprise-01',
    deck: 'surprise',
    text: 'Your itinerary falls apart and the only sane option is to start over. Move to START and collect your START salary.',
    effect: { kind: 'move_to', tileIndex: 0, collectStart: true },
  },
  {
    id: 'surprise-02',
    deck: 'surprise',
    text: 'A gate change sends you hustling four stops down the terminal. Move forward 4 spaces.',
    effect: { kind: 'move_relative', spaces: 4 },
  },
  {
    id: 'surprise-03',
    deck: 'surprise',
    text: 'You board the wrong shuttle and end up further along than planned. Move forward 7 spaces.',
    effect: { kind: 'move_relative', spaces: 7 },
  },
  {
    id: 'surprise-04',
    deck: 'surprise',
    text: 'Your connecting flight is overbooked, so the airline puts you on standby for the nearest airport. Move forward to the nearest airport (collect your START salary if you pass START). If it is owned, pay its owner double the normal rent; if not, you may buy it.',
    effect: { kind: 'move_to_nearest', tileType: 'airport', rentMultiplier: 2 },
  },
  {
    id: 'surprise-05',
    deck: 'surprise',
    text: 'Another standby bump, another reroute. Move forward to the nearest airport (collect your START salary if you pass START). If it is owned, pay its owner double the normal rent; if not, you may buy it.',
    effect: { kind: 'move_to_nearest', tileType: 'airport', rentMultiplier: 2 },
  },
  {
    id: 'surprise-06',
    deck: 'surprise',
    text: 'A regional blackout diverts you to the nearest utility company to sort out the mess. Move forward to the nearest company (collect your START salary if you pass START). If it is owned, pay its owner 10 times your last dice total; if not, you may buy it.',
    effect: { kind: 'move_to_nearest', tileType: 'company', rentMultiplier: 10 },
  },
  {
    id: 'surprise-07',
    deck: 'surprise',
    text: 'Your loyalty program pays out a surprise travel bonus. Collect $50.',
    effect: { kind: 'money', amount: 50 },
  },
  {
    id: 'surprise-08',
    deck: 'surprise',
    text: 'A consulate official owes you a favor and hands you a note that clears any trouble with the authorities. Keep it until you need it to leave Prison.',
    effect: { kind: 'pardon' },
  },
  {
    id: 'surprise-09',
    deck: 'surprise',
    text: 'You realize you left your bag at the last gate and have to double back. Move back 3 spaces.',
    effect: { kind: 'move_relative', spaces: -3 },
  },
  {
    id: 'surprise-10',
    deck: 'surprise',
    text: 'A random security check does not go your way at all. You are sent straight to Prison.',
    effect: { kind: 'go_to_jail' },
  },
  {
    id: 'surprise-11',
    deck: 'surprise',
    text: 'A customs inspector finds fault with every building you own and bills you for it. Pay $25 per house and $100 per hotel you own.',
    effect: { kind: 'repairs', perHouse: 25, perHotel: 100 },
  },
  {
    id: 'surprise-12',
    deck: 'surprise',
    text: 'Caught speeding through a toll checkpoint. Pay $15.',
    effect: { kind: 'money', amount: -15 },
  },
  {
    id: 'surprise-13',
    deck: 'surprise',
    text: 'A local guide walks you through a back-alley shortcut. Move forward 5 spaces.',
    effect: { kind: 'move_relative', spaces: 5 },
  },
  {
    id: 'surprise-14',
    deck: 'surprise',
    text: "You're elected trip coordinator for the group and end up covering everyone's incidentals. Pay $50 to every other player.",
    effect: { kind: 'money_from_each', amount: -50 },
  },
  {
    id: 'surprise-15',
    deck: 'surprise',
    text: 'A property investment abroad finally matures. Collect $150.',
    effect: { kind: 'money', amount: 150 },
  },
  {
    id: 'surprise-16',
    deck: 'surprise',
    text: 'A stranger hands you a ticket for a mystery route. Move forward 9 spaces.',
    effect: { kind: 'move_relative', spaces: 9 },
  },
];
