// Rental agreement (contract) — single source of truth.
//
// This is the actual CJ's Fun Time Rentals rental agreement transcribed from
// the paper forms. Everything that stores/shows the contract (checkout page,
// id-upload function, webhook, admin) reads from this one module.
//
// The exact text the customer accepted is snapshotted onto each booking at
// acceptance time, so bumping the version later never rewrites historical
// agreements that customers already signed.

export const AGREEMENT_VERSION = 'v1.0';

export const RENTAL_AGREEMENT_TEXT = `CJ'S FUN TIME RENTALS — RENTAL AGREEMENT

This Car Rental Agreement ("Agreement") is made and entered into between Christopher L. Johnson (hereafter referred to as the "Owner") and Renter (hereafter referred to as "Party" in the singular and "Parties" in the plural). This Agreement is intended to be the binding contract between the Parties for rental of the Vehicle.

RENTAL VEHICLE

Owner hereby agrees to rent to Renter the following vehicle ("Vehicle"):
• Vehicle details will be confirmed at booking and shown on your receipt
• Renter agrees to present valid identification matching this booking at pickup

RENTAL PERIOD

Owner agrees to rent Vehicle to Renter for the period specified in your booking confirmation. The Parties agree that this Agreement commences upon the start date and ends on the end date specified in your booking. Notwithstanding anything to the contrary in this Agreement, Owner and Renter may agree to extend the Rental Period of the Vehicle. If the Rental Period is terminated prior to the end date, the Parties will work together to determine whether a refund of Rental Fee is necessary.

MILEAGE LIMIT

Renter will be subject to mileage limits as specified at booking. Excess mileage charges may apply per mile over the limit.

RENTAL FEES

The Renter hereby agrees to pay the Owner for use of the Vehicle the total amount shown at checkout, as confirmed in your booking receipt.

INDEMNITY

Regardless of insurance coverage, Renter shall fully indemnify the Owner for any and all loss, damage, or personal injury that may occur during the use of the Vehicle due to the fault or negligence of the Renter. Renter shall indemnify Owner for any and all costs, including but not limited to damage to the Vehicle, damage to the property of others, injury to Renter, and injury to others. This indemnity shall survive the termination of this Agreement and shall be binding.

INSURANCE

The Owner represents to the best of his knowledge and belief that the Vehicle is in sound mechanical condition and is fully insured in accordance with the requirements of state law under normal use.

RENTER WARRANTIES

The Renter warrants that Renter will not (i) use the Vehicle to carry any passengers other than Renter; (ii) allow any other person to operate the Vehicle; (iii) operate the Vehicle in violation of any laws; (iv) operate the Vehicle in a negligent, abusive or reckless manner; (v) operate the Vehicle for any race or competition; (vi) operate the vehicle in a reckless manner.

ARBITRATION

In the event that the Parties cannot amicably resolve a dispute or damage claim resulting from the use of the Vehicle, the Parties agree to resolve the dispute via mediation and then by arbitration in accordance with the rules and procedures of the American Arbitration Association then in effect with one (1) arbitrator to be selected by mutual agreement of the Parties. If the Parties cannot reach a mutual agreement, then the American Arbitration Association shall appoint the arbitrator. The decision of the arbitrator shall be binding on the Parties and shall be enforceable in any court of the State of Pennsylvania in the United States. The laws of the State of Pennsylvania in the United States shall apply to the arbitration proceedings. The Parties agree that the arbitrator cannot modify or change this Agreement in any manner and shall only determine whether a breach of this Agreement has occurred.

GOVERNING LAW AND JURISDICTION

The laws of the State of Pennsylvania in the United States, without regard to any conflict of law provisions, shall govern this Agreement. In the event that litigation occurs concerning this Agreement, the prevailing party may be awarded by either Party more than one year after the cause of action has accrued.

GENERAL

This Agreement, including all Exhibits, constitutes the entire agreement between the Parties in connection with the Vehicle rental and supersedes all agreements, proposals, representations, and other understandings, oral or written, of the Parties hereto in connection with such rental. This Agreement may not be amended, changed, modified, or terminated, in whole or in part, except by a written agreement executed by the Parties hereto. This Agreement shall be binding upon and inure to the benefit of the Parties hereto and their respective heirs, successors, and permitted assigns. No waiver by either of the Parties hereto of any subsequent breach of any provision of this Agreement by the other Party shall be deemed to be a waiver of any preceding or subsequent breach of the same or any other provision of this Agreement.

ACCEPTANCE

By checking the acceptance box and completing your booking, you acknowledge that:

1. You have read and understood this entire Agreement
2. You agree to all terms and conditions stated herein
3. You will present a valid government-issued photo ID at pickup that matches the ID uploaded with this booking
4. For Can-Am Spyder rentals: You hold a valid driver's license with a motorcycle (M) endorsement, which will be verified in person before the vehicle is released
5. You are the person who will operate the vehicle and are legally permitted to do so
6. You will return the vehicle on time and in the same condition provided
7. You accept full responsibility for damage, loss, citations, or tolls incurred during your rental period

This online acceptance creates a binding agreement. A printed copy will be provided for your records at pickup.

CJ's Fun Time Rentals · Lancaster, PA`;
