// Static site configuration for production (Netlify)
// Regenerated from the live database (site_config table) on 2026-07-15 to fix
// stale vehicle years/prices that had drifted from the DB since this file was
// last hand-written. Vehicles/pricing/copy should be treated as a snapshot —
// re-run this generation whenever the DB config changes materially.
//
// FALLBACK ONLY: index.html loads the live /functions/v1/config script
// (synchronously, before this one) to populate window.SITE_CONFIG from the
// database. This file only fills in SITE_CONFIG if that live fetch failed
// (e.g. Supabase unreachable) — it must never overwrite good live data with
// this stale snapshot, which is why the assignment below is conditional.
window.SITE_CONFIG = window.SITE_CONFIG || {
  "sections": {
    "faq": {
      "visible": true
    },
    "how": {
      "visible": true
    },
    "hero": {
      "visible": true
    },
    "fleet": {
      "visible": true
    },
    "header": {
      "visible": true
    },
    "reviews": {
      "visible": true
    },
    "ctaSection": {
      "visible": true
    },
    "leadCapture": {
      "visible": true
    }
  },
  "sectionOrder": [
    "header",
    "hero",
    "fleet",
    "how",
    "reviews",
    "ctaSection",
    "leadCapture",
    "faq"
  ],
  "vehicles": {
    "canam_spyder": {
      "img": "Can_Am_Spyder_F3_Limited.png",
      "tag": "Premium Touring · M License Required",
      "name": "2021 Can-Am Spyder F3",
      "label": "2021 Can-Am Spyder F3 Limited",
      "specs": "3-Wheel Stability · 2 Seats · F3 Limited · Heated Grips",
      "badges": [
        "Premium Pick",
        "3-Wheeler",
        "Touring Comfort"
      ],
      "safety": [
        "Stability Control System (SCS) standard",
        "ABS with cornering ABS (C-ABS)",
        "Traction Control System (TCS)",
        "Vehicle Hold Assist (VHA) on hills",
        "Motorcycle license required in PA",
        "Insurance & protection included in every rental"
      ],
      "reviews": [
        {
          "name": "Tiffany G.",
          "text": "The Can-Am is so comfortable for longer rides. Heated grips and the GPS made our day trip to Philly amazing.",
          "rating": 5
        },
        {
          "name": "Robert H.",
          "text": "Premium doesn't begin to describe it. Smoothest ride I've ever had on three wheels.",
          "rating": 5
        },
        {
          "name": "Deja L.",
          "text": "CJ had everything ready and walked us through all the controls. We felt safe the whole time. Will be back!",
          "rating": 5
        },
        {
          "name": "Mike P.",
          "text": "The saddlebags were a game changer for our trip. CJ's service is unmatched.",
          "rating": 5
        }
      ],
      "tagline": "Long-haul luxury meets open-road freedom — the Can-Am built for adventure.",
      "features": [
        "SE6 semi-auto transmission — smooth paddle-shift",
        "Heated grips & heated seat (driver)",
        "Premium touring windshield",
        "Integrated hard-sided saddlebags",
        "Air-ride adjustable rear suspension",
        "LED lighting throughout",
        "Reverse gear standard",
        "Large fuel tank for long-distance trips"
      ],
      "included": [
        "300 miles per trip included",
        "Insurance & protection coverage",
        "Pickup & return in Lancaster, PA",
        "Full tank of gas at pickup",
        "Pre-trip vehicle walkthrough",
        "Motorcycle license required in PA",
        "3-day discount: 10% off",
        "Weekly discount: 15% off"
      ],
      "available": true,
      "specsList": [
        "2021 model year",
        "SE6 semi-automatic transmission",
        "Rotax 1330 ACE · 115 hp",
        "3-wheel motorcycle",
        "2 seats (driver + passenger)",
        "300 miles included per trip",
        "Motorcycle license required in PA"
      ],
      "ratePerDay": 250,
      "connectivity": [
        "Garmin GPS navigation (integrated)",
        "Bluetooth audio with premium speakers",
        "Hands-free phone integration",
        "USB charging ports",
        "LinQ accessory mounting system"
      ],
      "stripeProductId": "prod_UHai9cIGKdkLoW"
    },
    "slingshot_2020": {
      "img": "gray_polaris_front.png",
      "tag": "Great Value · Manual",
      "name": "2016 Polaris Slingshot",
      "color": "Gray",
      "label": "2016 Polaris Slingshot S",
      "specs": "3-Wheel Autocycle · 2 Seats · 5-Speed Manual",
      "badges": [
        "3-Wheeler",
        "Manual Transmission",
        "Pure Driver's Machine"
      ],
      "safety": [
        "Automotive-grade seat belts",
        "Roll hoops for occupant protection",
        "ABS braking system",
        "Traction control",
        "No motorcycle license required in PA",
        "Insurance & protection included in every rental"
      ],
      "reviews": [
        {
          "name": "Jake S.",
          "text": "The manual transmission on the gray Slingshot made it feel so raw and real. Loved every second.",
          "rating": 5
        },
        {
          "name": "Marcus W.",
          "text": "If you know how to drive manual, get this one. Pure joy on backroads.",
          "rating": 5
        },
        {
          "name": "Ashley N.",
          "text": "Beautiful car, great condition, CJ was incredibly helpful. Already planning my next trip.",
          "rating": 5
        }
      ],
      "tagline": "Raw, manual, mechanical — the Slingshot the way driving was meant to feel.",
      "features": [
        "Open-air cockpit with 180° panoramic views",
        "Aggressive sport-tuned suspension",
        "7” touchscreen infotainment display",
        "LED daytime running lights",
        "Sporty bucket seats",
        "Push-button start",
        "Rear-view camera",
        "Digital instrument cluster"
      ],
      "included": [
        "300 miles per trip included",
        "Insurance & protection coverage",
        "Pickup & return in Lancaster, PA",
        "Full tank of gas at pickup",
        "Pre-trip vehicle walkthrough",
        "No motorcycle license required",
        "3-day discount: 10% off",
        "Weekly discount: 15% off"
      ],
      "available": true,
      "specsList": [
        "2016 model year",
        "5-speed manual transmission",
        "2.0L 4-Cyl · 173 hp",
        "3-wheel autocycle",
        "2 seats (driver + passenger)",
        "300 miles included per trip"
      ],
      "ratePerDay": 250,
      "connectivity": [
        "7” Touchscreen infotainment display",
        "Bluetooth audio & phone integration",
        "USB charging port",
        "AM/FM/SiriusXM ready"
      ],
      "stripeProductId": "prod_UHaiT4pRmY2sos"
    },
    "slingshot_2022": {
      "img": "cj_orange_sling.jpg",
      "tag": "Most Popular · No Moto License",
      "name": "2024 Polaris Slingshot",
      "color": "Orange",
      "label": "2024 Polaris Slingshot SL",
      "specs": "3-Wheel Autocycle · 2 Seats · AutoDrive · Open-Air",
      "badges": [
        "Best Seller",
        "AutoDrive (No Clutch)",
        "3-Wheeler"
      ],
      "safety": [
        "Automotive-grade seat belts (front & rear anchorage)",
        "Roll hoops for occupant protection",
        "Electronic Stability Control (ESC)",
        "ABS with traction control",
        "No motorcycle license required in PA",
        "Insurance & protection included in every rental"
      ],
      "reviews": [
        {
          "name": "Samuel A.",
          "text": "This was an incredible experience! CJ was the best host I've ever had on any platform. Would 100% book again.",
          "rating": 5
        },
        {
          "name": "Kayla R.",
          "text": "The orange slingshot was absolutely stunning. So much fun — drew attention everywhere we went in Lancaster.",
          "rating": 5
        },
        {
          "name": "Brian T.",
          "text": "Super clean, super fast, and CJ made the whole process smooth. AutoDrive is perfect if you're nervous about manual.",
          "rating": 5
        },
        {
          "name": "Deondra M.",
          "text": "Best road trip vehicle I've ever driven. The sound system alone is worth it.",
          "rating": 5
        }
      ],
      "tagline": "The ultimate open-air thrill machine — orange, aggressive, unforgettable.",
      "features": [
        "Open-air cockpit with 180° panoramic views",
        "Premium Rockford Fosgate audio system",
        "Alpine 7” touchscreen with Apple CarPlay",
        "LED daytime running lights & performance lighting",
        "Sporty bucket seats with 4-point harness mounts",
        "Rear-view camera standard",
        "Push-button start",
        "USB charging ports (front)"
      ],
      "included": [
        "300 miles per trip included",
        "Insurance & protection coverage",
        "Pickup & return in Lancaster, PA",
        "Full tank of gas at pickup",
        "Pre-trip vehicle walkthrough",
        "No motorcycle license required",
        "3-day discount: 10% off",
        "Weekly discount: 15% off"
      ],
      "available": true,
      "specsList": [
        "2024 model year",
        "AutoDrive — no clutch, no stall",
        "2.0L 4-Cyl · 203 hp",
        "3-wheel autocycle",
        "2 seats (driver + passenger)",
        "300 miles included per trip"
      ],
      "ratePerDay": 250,
      "connectivity": [
        "Apple CarPlay via Alpine 7” touchscreen",
        "Bluetooth audio & hands-free calling",
        "Rockford Fosgate 4-speaker sound system",
        "USB charging ports",
        "Integrated GPS navigation"
      ],
      "stripeProductId": "prod_UHaiSY5zFpsDcV"
    },
    "slingshot_2016_red": {
      "img": "red_polaris_slingshot.png",
      "tag": "Classic Manual · Driver's Machine",
      "name": "2016 Polaris Slingshot",
      "type": "slingshot",
      "color": "Red",
      "label": "2016 Polaris Slingshot S (Red)",
      "specs": "3-Wheel Autocycle · 2 Seats · 5-Speed Manual",
      "badges": [
        "3-Wheeler",
        "Manual Transmission",
        "Classic Red"
      ],
      "safety": [
        "Automotive-grade seat belts",
        "Roll hoops for occupant protection",
        "ABS braking system",
        "Traction control",
        "No motorcycle license required in PA",
        "Insurance & protection included in every rental"
      ],
      "reviews": [
        {
          "name": "Mike R.",
          "text": "The manual transmission makes this so much fun. Perfect for enthusiasts who love to shift gears.",
          "rating": 5
        }
      ],
      "tagline": "Pure manual driving experience in classic red.",
      "features": [
        "Open-air cockpit with 180° panoramic views",
        "Sport-tuned suspension",
        "Manual 5-speed transmission",
        "LED daytime running lights",
        "Sporty bucket seats",
        "Push-button start",
        "Digital instrument cluster"
      ],
      "included": [
        "300 miles per trip included",
        "Insurance & protection coverage",
        "Pickup & return in Lancaster, PA",
        "Full tank of gas at pickup",
        "Pre-trip vehicle walkthrough",
        "No motorcycle license required",
        "3-day discount: 10% off",
        "Weekly discount: 15% off"
      ],
      "available": true,
      "specsList": [
        "2016 model year",
        "5-speed manual transmission",
        "2.4L 4-Cyl · 173 hp",
        "3-wheel autocycle",
        "2 seats (driver + passenger)",
        "300 miles included per trip"
      ],
      "ratePerDay": 250,
      "connectivity": [
        "Bluetooth audio & phone integration",
        "USB charging port",
        "AM/FM radio"
      ],
      "stripeProductId": ""
    }
  },
  "pricing": {
    "delivery": {
      "fee": 0,
      "enabled": false,
      "maxMiles": 0,
      "locationName": "Lancaster, PA"
    },
    "multiDay": [],
    "dailyRate": {
      "canam": 0,
      "slingshot": 0
    },
    "hourlyCap": 180,
    "hourlyMin": 0,
    "tenhrRate": {
      "canam": 0,
      "slingshot": 0
    },
    "hourlyRate": 0,
    "multiDayRate": 220
  },
  "copy": {
    "cta": {
      "body": "Weekends fill up fast — reserve your ride in minutes.",
      "headline": "Book Your<br>Ride Today",
      "buttonText": "Book Your Ride →"
    },
    "faq": {
      "subtext": "Everything you need to know before you book.",
      "headline": "Common<br>Questions"
    },
    "how": {
      "subtext": "From booking to riding — simple as that.",
      "headline": "Ready in 3 Steps",
      "step1Body": "Choose your vehicle — the 2022 Polaris Slingshot SL (AutoDrive), the 2020 Slingshot S (manual), or the 2021 Can-Am Spyder F3 Limited. Pick your dates and pay securely online with Stripe. Weekends fill fast, especially May through October — lock in your spot before someone else does.",
      "step2Body": "Chris meets you at the Lancaster, PA pickup location and walks you through the vehicle controls, safety features, and anything you want to know. Most renters are comfortable and rolling within 10 minutes. All you need is a valid PA or out-of-state driver's license — no motorcycle experience required.",
      "step3Body": "Explore Central Pennsylvania on three wheels with no constraints. Head to Gettysburg (45 min), the Pocono Mountains (90 min), or cruise Lancaster County's back roads and covered bridge routes. Each rental includes 600 miles — more than enough for a full day or multi-day adventure.",
      "step1Title": "Book & Pay",
      "step2Title": "Meet in Lancaster",
      "step3Title": "Hit the Road"
    },
    "hero": {
      "headline": "<span style=\"color:var(--orange)\">Polaris Slingshot</span><br>Rental Lancaster, PA",
      "ctaPrimary": "Book Your Ride →",
      "subheadline": "No motorcycle license needed. Just show up and ride.",
      "ctaSecondary": "Get 10% Off →"
    },
    "fleet": {
      "subtext": "",
      "headline": "Choose<br>Your Ride"
    },
    "reviews": {
      "headline": "What Guests Say",
      "ratingLine": "5.0 ★★★★★ · All Verified Renters"
    },
    "leadCapture": {
      "body": "Enter your email and we'll send you a 10% off code for your first booking.",
      "eyebrow": "🎉 First-Time Renter Offer",
      "headline": "Get <span>10% Off</span><br>Your First Rental",
      "finePrint": "We respect your privacy. No spam — ever. Unsubscribe anytime.",
      "buttonText": "Send Me the Discount →"
    }
  },
  "faqs": [
    {
      "id": "faq-1",
      "answer": "No motorcycle license needed. In Pennsylvania, the Polaris Slingshot is classified as an autocycle — all you need is a standard driver's license. That makes it one of the most accessible thrill rides you can rent in Central PA.",
      "visible": true,
      "question": "Can I rent a Polaris Slingshot in Lancaster, PA without a motorcycle license?"
    },
    {
      "id": "faq-2",
      "answer": "The Can-Am Spyder F3 starts at $160/day and our Slingshots are $180/day. Multi-day rentals qualify for discounts — 10% off for 3+ days, 15% off for a full week. No hidden fees, book directly on this page.",
      "visible": true,
      "question": "How much does it cost to rent a Polaris Slingshot near me?"
    },
    {
      "id": "faq-3",
      "answer": "Both are 3-wheel autocycles that don't require a motorcycle license. The Slingshot is side-by-side seating — driver and passenger sit next to each other like a car. The Can-Am Spyder is tandem — passenger sits behind the driver like a motorcycle. The Spyder is more of a touring ride; the Slingshot is pure open-air sport.",
      "visible": true,
      "question": "What's the difference between a Polaris Slingshot and a Can-Am Spyder?"
    },
    {
      "id": "faq-4",
      "answer": "Not at all. Our Slingshots have AutoDrive — no clutch, no manual shifting. If you can drive a car, you can drive a Slingshot. Most renters are comfortable within the first few minutes.",
      "visible": true,
      "question": "Is a Polaris Slingshot hard to drive?"
    },
    {
      "id": "faq-5",
      "answer": "We're based in Lancaster, PA — centrally located and easy to reach from York (30 min), Harrisburg (45 min), and Reading (45 min). We serve all of Central Pennsylvania. Reserve online and Chris will confirm your exact pickup location.",
      "visible": true,
      "question": "Where can I rent a Slingshot near York, Harrisburg, or Reading PA?"
    },
    {
      "id": "faq-6",
      "answer": "Each rental includes 300 miles per trip. That's more than enough for a full day of exploring Central PA's scenic routes. Insurance coverage is included and full details are provided at booking confirmation.",
      "visible": true,
      "question": "What's included in the rental — are there mileage limits?"
    },
    {
      "id": "faq-7",
      "answer": "Yes. Both vehicles are fully highway-capable and street-legal in Pennsylvania. They're built for it — scenic routes, open highways, back roads through Lancaster County. Just bring your standard driver's license and you're good to go.",
      "visible": true,
      "question": "Can I take a rented Slingshot or Spyder on the highway in Pennsylvania?"
    }
  ],
  "discounts": [
    {
      "pct": 15,
      "days": 7,
      "label": "Weekly discount",
      "enabled": true
    },
    {
      "pct": 10,
      "days": 3,
      "label": "3-day discount",
      "enabled": true
    }
  ],
  "blockedDates": [
    "2026-07-04",
    "2026-07-06",
    "2026-07-16",
    "2026-07-25",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22"
  ]
};
