# Chris's review-reply voice

Reference corpus: every reply on CJ's Fun Time Rental's Google Business
Profile as of 2026-09-07. Three replies, all to 5-star reviews.

| Review | Chris's reply |
|---|---|
| Jiniah Gonzalez, 5★ ("answered my 2am call") | "Very nice young lady, we look forward to the next rental" |
| Tavon Jackson, 5★ ("process was easy, owner friendly") | "Thanks for supporting CJ's Funtime rental, look forward to seeing you again" |
| preston moragne, 5★ ("43 mile trip, nighttime ride") | "Thanks for your support!" |

## What is actually there

**Very short.** Five to thirteen words. One sentence, sometimes one clause.
Never a paragraph. This is the single most important rule: a long reply does
not sound like him no matter how well the words are chosen.

**Two moves, and only two.** Thank them for the support, and/or say he looks
forward to seeing them again. Every reply is one or both.

**"We", not "I".** He speaks for the business even though it is him and his
wife. Never "I'm so glad you..."

**No exclamation stacking.** At most one, usually none.

**Plain words.** No "thrilled", "delighted", "means the world to us",
"valued customer", "your feedback". No marketing register at all.

**Does not restate the review.** He never echoes details back ("so glad you
enjoyed the scenery!"). This is the tell that separates a real reply from a
generated one, and the easiest rule to accidentally break.

**Occasionally personal, but NOT reproducibly so.** "Very nice young lady" is
a real observation from someone who met her at a handover. A generator knows
none of that: it would be inferring age and gender from a name, which is how
you end up calling a 40-year-old man "young lady" in public. See the hard
rules below. Warmth has to come from plainness, not from describing anyone.

**Light punctuation.** No em dashes. Comma splices are fine and normal for
him. Do not clean up his grammar into something more formal than he is.

**Never mentions:** the booking site, promo codes, "follow us", any CTA. A
reply is a thank-you, not marketing.

## Rules for generated replies

1. Hard cap 20 words. Aim for 8 to 14.
2. One sentence. Two only if both are very short.
3. Use "we". Never "I".
4. At most one exclamation mark, and only if the review is enthusiastic.
5. Do not repeat specifics from the review back at the reviewer.
6. No em dashes (blanket rule across everything outward-facing).
7. No CTA, no links, no promo codes.
8. Open with "Thanks" most of the time, since two of his three replies do.
   Occasionally "Glad you..." or the reviewer's first name. Do NOT invent
   phrasings absent from the corpus to force variety; staying close to three
   real samples beats sounding like a different person.
9. Use the reviewer's first name occasionally, not every time.
10. NEVER describe the reviewer. No "young lady", "gentleman", "guys",
    "you two", "lovely couple", no gendered terms, no guesses at age, sex or
    relationship. First name only, or nothing. Chris can say that because he
    met them; a generator cannot, and a wrong guess is public and permanent.
11. Never apologise, promise anything, discuss money, or admit fault. Those
    replies are not generated at all, they go to Chris. See routing.

## Worked example

Regin Mema, 5★: "Cj and his wife were amazing! They made the experience great
and easy, the slingshot was very well maintained and the scenery around the
area was beautiful. 10/10 id reccomend"

- Good: "Thanks Regin, we look forward to seeing you again"
- Good: "Appreciate the kind words, come ride with us again soon"
- Wrong: "Thank you so much for the wonderful review! We're thrilled you
  enjoyed the scenery and found the Slingshot well maintained. We can't wait
  to welcome you back!" (too long, restates the review, marketing register,
  three sentences)

## Routing: which reviews may be answered automatically

Star rating alone is NOT the gate. A 5-star review that says "great ride, but
pickup was 40 minutes late and the seat was sticky" needs a person, and a
cheerful canned line under it is exactly the screenshot we are trying to avoid.

**Send to Chris for approval, never auto-post, if ANY of these are true:**
- Rating is 3 stars or below.
- The text matches a complaint signal, case-insensitive, even at 5 stars:
  late, wait, waiting, dirty, filthy, broken, damage, scratch, refund,
  charge, charged, overcharged, deposit, rude, unprofessional, disappointed,
  unfortunately, however, but, issue, problem, never again, wouldn't, didn't.
- The text mentions an accident, injury, police, insurance or a legal threat.
  These are escalations, not reviews.
- The review is in a language other than English.

**May be auto-posted:**
- 4 or 5 stars, and no signal above fires.

**Always skip, regardless of rating:**
- Any review that already has an owner reply. Chris may have got there first,
  and a second reply cannot be added anyway.
- Any review already recorded as replied to in our own store, so a retry or a
  re-run can never post twice.

**Star-only reviews with no text:** 5 stars with no words gets "Thanks for
your support!", which is a real reply of his. 4 stars with no words goes to
Chris, since we cannot tell what the missing star was for.

## Two tiers, one spec

**Auto-post tier (4-5 star, clean):** do not free-generate. With a
three-reply corpus and a public permanent output, use a fixed bank of short
replies written to this spec and approved by Chris once, rotated so the
profile does not show the same sentence five times, with the first name
slotted in where the template allows. Predictable, reviewable in advance, and
it cannot drift.

**Draft tier (everything routed to Chris):** free generation against this
spec is fine here, because a person reads it before it goes anywhere.
