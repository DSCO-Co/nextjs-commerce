/**
 * Sample checkout route handler — the first-party endpoint `cart.checkoutUrl`
 * points at (`/api/checkout`).
 *
 * WHY this exists: Flightdeck has no hosted checkout page to redirect to (see
 * the impedance-mismatch note in `lib/flightdeck/index.ts`). Checkout is a
 * single `store.checkout.submit` call that takes the card directly. So the fork
 * owns the payment-form UI; this handler is the server side of it — it reads the
 * cookie cart, places the order, and clears the cart on success.
 *
 * A production fork would: gate this behind CSRF / rate limits, collect and
 * validate the card + shipping in its own UI, and likely tokenize the card
 * before it reaches the server. This sample keeps the shape minimal on purpose.
 */
import { type NextRequest, NextResponse } from "next/server";
import {
  type CheckoutInput,
  FlightdeckError,
  submitCheckout,
} from "lib/flightdeck";

/** GET is informational — the real work is the POST below. */
export function GET(): NextResponse {
  return NextResponse.json({
    message:
      "POST here with a JSON checkout body (customer_ref, card, shipping_address, …). " +
      "The line items come from your fd_cart cookie, not the request body.",
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let input: CheckoutInput;
  try {
    // Localized assertion: the request body is caller-supplied JSON; the SDK
    // validates the concrete shape when `submitCheckout` calls the API.
    input = (await req.json()) as CheckoutInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await submitCheckout(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Surface a real API error verbatim (status + parsed body); anything else
    // (e.g. an empty cart) becomes a 400 with its message.
    if (error instanceof FlightdeckError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
