# Campus Survival Assistant

Ask in plain English, get a plan that actually fits the time you have.

> "I have 30 minutes between classes in SL and I'm hungry."
>
> "I have 8 minutes to get from the library to SL."

## What it does

Google Maps can tell you how far away something is. It can't tell you whether
you have time for it. The gap between two classes isn't a routing problem —
it's a constraint problem, and the constraints are walking time, service time,
opening hours, and how late you're willing to be.

This app solves that. You describe your situation in a sentence, and it returns
a ranked set of options with the full time breakdown: how long to walk there,
how long you'll wait for food, how long to get to your next class, and how much
buffer you're left with.

## Panic mode

When the time budget is impossible, the app doesn't give up — it returns
tradeoffs. What makes it, what doesn't, how late each option lands, and what
accepting two extra minutes actually buys you.

It also knows where the **vending machines** are, which Google Maps doesn't.
When you have eight minutes, a vending machine on your route is often the right
answer, and the app says so plainly.

## How it works

Three stages:

1. **Intent parsing** — Gemini turns a messy sentence into structured data:
   where you are, where you're going, how many minutes you have, and whether
   this is urgent.
2. **Feasibility math** — plain JavaScript computes every distance, walking
   time, and opening-hours check against verified campus coordinates. The
   language model never touches arithmetic, so the numbers can't drift.
3. **Narration** — Gemini writes the recommendation over the computed results,
   under instruction never to recalculate or invent anything.

Every number the app shows you was computed, not generated.

## Data

Campus coordinates were collected and verified by hand, including dining
locations with realistic service times and vending machines that aren't on any
map. The dataset is static, so the app makes no location API calls at runtime.
