# Client Booking Form Requirements Document

**Source**: https://docs.google.com/document/d/e/2PACX-1vQzOZesyEalQe24DxQQMYBtYredjcTS39foSM-Z03BPBzgEGHdy39FUuqHAY1LDzX7QHIlAqS2hQRny/pub?urp=gmail_link
**Last Fetched**: 2026-06-17
**Auto-updates**: Every 5 minutes when edited by client

---

## Overview

Central PA Talent is developing a comprehensive client booking form to streamline talent acquisition. The system addresses workflow improvements, enhanced communication, detailed information gathering, pricing standardization, and business hour enforcement.

## Core Goals

- Improve operational workflow
- Enhance client-talent communication
- Gather comprehensive project details
- Enforce consistent pricing structures
- Increase client retention
- Provide intuitive user experience
- Facilitate casting call and call sheet generation

## Form Structure

### Two-Section Progressive Workflow

**Section One: Casting Call Information**
Creates the foundational project details. Clients can save progress and return to edit responses.

**Section Two: Call Sheet Generation**
Converts Section One data into detailed on-set instructions for talent, with client review capability.

### Key Features

**Learn More Tab**
Provides overview covering:
- Site usage benefits
- Booking policies
- Industry terminology definitions
- Casting process explanation

**Unique Client Login**
Enables returning clients to access incomplete forms and modify previous submissions.

**Key Terms Glossary**
Industry terms appear clickable throughout, displaying definitions via scrollable overlay. Consistent visual indicators (bold, highlight, underline, or question mark) mark terminology.

**Booking Policies**
Embedded slideshow appearing at form top, containing complete booking guidelines.

## Budget Calculator System

### Purpose
Enforces market rate minimums while accommodating smaller businesses through educational messaging rather than blocking submissions.

### Market Rates (Hourly)
- Models: ≥$100
- Actors: ≥$150
- Non-speaking actors: ≥$100
- Extras/background: ≥$30
- Stylists: ≥$100
- Tradeshow talent: ≥$50

### Market Rates (Day Rate)
- Models: ≥$900
- Actors: ≥$1,000
- Non-speaking actors: ≥$900
- Stylists: ≥$900
- Extras/background: $200

### Rate Correction Logic

When budget falls below market rate: "The budget entered is below market rate (display market rate)."

**Key Variables Impacting Calculations:**
- 20% agency fee applied universally
- Usage type (commercial vs. editorial)
- Number of talent per division
- On-set duration (hourly rate × hours)

Rate corrections appear only when minimum thresholds unmet. Higher budgets trigger no correction messaging.

## Section One: Questions (All Talent)

### Talent Type Selection
Clients indicate required divisions:
- Models
- Actors
- Hair/Makeup Artists (HMUA)
- Animal Actors

*Note: HMUA and animal actor divisions receive abbreviated question sets pending development; clients provide date, location, budget only.*

### Ghost Questions (Conditional)
Questions appear only after specific selections. Example: selecting "visible tattoos" triggers follow-up asking body placement preferences.

### Talent Specifications

**Number & Demographics**
- Quantity per division
- Gender preference(s)
- Age range required
- Actual age vs. appearance flexibility
- Ethnicity requirements
- Ethnicity accuracy vs. appearance flexibility
- Accent specifications (standard American, Italian, etc.)

**Project Requirements**
- Special skills/features needed (open-ended text)
- Shooting location(s) — city and state only, no addresses
- Indoor/outdoor setting
- Studio vs. on-location booking

### Wardrobe & HMUA
- HMUA availability (on-set vs. camera-ready)
- Attire provision by production
- Non-standard wardrobe/exposure requirements (swimwear, lingerie-inspired, shirtless, undergarments, sheer clothing, implied nudity)
- Detailed exposure context if applicable

### Couples/Intimacy Requirements
- Couple portrayal necessity
- Intimacy level descriptions
- Intimacy coordinator presence

### Actor-Specific Questions
- Actor type: speaking, non-speaking, background, or custom category
- Self-tape requirement
- Self-tape script upload/entry
- Self-tape submission deadline
- Self-tape instructions upload
- Portfolio content sharing confirmation

### Booking Agreement Acceptance

Mandatory terms review covering:
- Booking detail changes and consequences
- On-set expectations
- Accurate information acknowledgment
- Payment processing through Central PA Talent exclusively
- 20% agency fee inclusion
- No direct talent payment without written approval
- Portfolio content delivery responsibility and timeline

## Section Two: Call Sheet & Final Booking

### Call Sheet Generation
Section One responses auto-populate the call sheet. Clients review and edit before distribution to booked talent.

**Call Sheet Contents:**
- Production/client details
- Date and time
- Location(s)
- Clothing requirements and photos
- Hair/makeup specifications
- Talent names and assigned roles
- Call time
- Estimated wrap time
- Special instructions
- Parking details (comprehensive information required)
- Nail preferences and requirements

### Specific Questions

**Talent Appearance**
- Featured look selection or alternative portfolio look
- Makeup styling specifications
- Hair styling specifications
- Nail length, polish type, natural vs. artificial preferences
- Manicure/pedicure requirement (yes/no/both)
- Polish type: standard, gel, or acrylic
- Professional removal compensation for acrylics/gels

**Wardrobe Details**
- Clothing photographs and storyboard samples (recommended)
- Detailed clothing descriptions and shoe requirements
- Arrival attire instructions
- Seasonal considerations
- Casual wear elaboration if applicable
- Warning regarding booking detail alterations affecting talent interest

**Payment Method**
- Mail or in-person payment options

**Couple Specifications**
- Couple type classification
- Physical intimacy level (hand-holding, kissing, etc.)

**Parking Information**
- Comprehensive, detailed parking guidance enabling comfortable talent navigation

## Auto-Responder Emails

### Section One Confirmation
**Subject:** Central PA Talent Section One Client Booking Form Confirmation

**Body Content:**
"Thank you for submitting your casting request through Central PA Talent. We have received your casting call information. Once we have reviewed your casting call details, all eligible talent will be notified. If any information is missing, unclear, or requires additional clarification, we will contact you before moving forward. Talent who are interested and available may accept the casting call. Central PA Talent will then prepare a talent deck for your team to review."

**Reply-To:** tashina@centralpatalent.com

**Follow-up for HMUA/Animal Actors:**
Same confirmation body; manual follow-up contact with additional questions required.

### Reminder Email (Two Days Before One-Week Deadline)
**Subject:** Reminder: Talent Deck Selection Deadline Approaching

**Body Content:**
"Your talent deck selection deadline is approaching. Talent are expected to hold the booking date for one week after the talent deck is shared. Following that one-week period, selected talent must accept or decline the updated details. Please finalize your selections as soon as possible to secure talent for your project."

## Deadline & Availability System

**One-Week Hold Period**
Talent must hold booking dates for minimum one week from talent deck delivery. After seven days, selected talent must affirmatively accept or decline revised booking details.

**Change Impact Notification**
Disclaimer required: Any Section One modifications after casting call submission trigger talent review; talent must re-accept or decline revised booking.

## Casting Call Saving Feature

**Prefill Option**
After completing and reviewing Section One, clients receive optional prompt: "Would you like to save your casting call information as a prefilled form? This feature benefits clients regularly booking similar projects. You will review and edit all information before official submission."

Options:
- Yes, save for future projects
- No, single-project booking only

*Note: Defaults to non-saved; functions as optional email subscription equivalent.*

## Form Customization & Branding

**Color Palette**
Currently: black and white base. Open to adding secondary color (blue variation suggested).

**Hosting**
Separate website implementation; clients access via clickable link from main site or "Book Talent" button in website footer.

## Implementation Phases

**Phase 2 (Priority)**
- Budget calculator minimums
- Email templates and automation
- Call sheet generation functionality
- Booking policies slideshow integration

**Phase 3 (Optional)**
- Talent availability checking (Staragent API integration pending)
- One-week deadline auto-calculation
- Email automation completion
- System countdown timer displays

## Administrative Notifications

**CPT Notification Requirements**
System alerts agency each time client edits form, enabling proactive communication and timeline management.

## Additional Specifications

**Error Message Example**
"The budget entered is below market rate (display market rate)."

**Portfolio Content Disclaimer**
Clients must provide promised portfolio materials within agreed timeframe unless otherwise documented in writing.

**Call Sheet Accessibility**
Displayed on-screen with PDF download capability for talent distribution.

**On-Set Expectations**
All clients acknowledge through form submission their understanding of Central PA Talent's booking procedures and commitment to accurate, complete information provision.

---

**Document Status:** In-progress requirements document with Phases 2-3 clarifications pending. Multiple sections marked for client feedback and specification refinement.
