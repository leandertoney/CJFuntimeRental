// Rental agreement (contract) — single source of truth.
//
// This is PLACEHOLDER text. When the owner provides the real rental agreement,
// replace RENTAL_AGREEMENT_TEXT below and bump AGREEMENT_VERSION. Everything that
// stores/shows the contract (checkout page, id-upload function, webhook, admin)
// reads from this one module, so a swap is a one-file change.
//
// The exact text the customer accepted is snapshotted onto each booking at
// acceptance time, so bumping the version later never rewrites historical
// agreements that customers already signed.

export const AGREEMENT_VERSION = 'placeholder-v1';

export const RENTAL_AGREEMENT_TEXT = `CJ'S FUN TIME RENTAL — RENTAL AGREEMENT (PLACEHOLDER)

This is placeholder rental-agreement text and is not the final contract. By
checking the box and completing your booking you acknowledge and agree to the
following:

1. Valid ID. You will present a valid government-issued photo ID at pickup that
   matches the ID uploaded with this booking. For the Can-Am Spyder you must hold
   a valid driver's license with a motorcycle (M) endorsement; it will be checked
   in person before the vehicle is released.

2. Eligible operator. You are the person who will operate the vehicle, you are
   legally permitted to drive it, and you will obey all traffic laws.

3. Condition & return. You will return the vehicle on time and in the same
   condition it was provided, normal wear excepted.

4. Responsibility. You accept responsibility for damage, loss, citations, or
   tolls incurred during your rental period, subject to the final signed
   agreement provided at pickup.

5. Final agreement. A complete rental agreement will be provided for signature at
   pickup. This online acknowledgment does not replace that document.

CJ's Fun Time Rental · Lancaster, PA`;
