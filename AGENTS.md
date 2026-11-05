<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (ST&ID)

- Roles live only in `public.user_roles`; `profiles.role` is a read-only mirror kept by a trigger. Why: clients must never be able to grant themselves admin.
- Admin accounts are granted only by a database change, never by sign-up, metadata or demo logins. Why: the demo password is public.
- Businesses never read `identities` directly; they use the `verify_traveler_qr` database function, which also writes the verification log. Why: passport data is shown only to a business holding the traveler's QR.
- Original pages live in `src/pages/*` and are mounted by thin route files in `src/routes/*` through `src/lib/router-compat.tsx`. Why: preserves the imported app with minimal rewrites.
- Passport OCR runs on the server through the Lovable AI Gateway (`extractPassport` in `src/lib/ocr.functions.ts`, auth-required); the browser only compresses the photo (`src/lib/ocr.ts`). MRZ check digits (`src/lib/mrz.ts`) cross-check the AI result. Why: browser Tesseract from CDNs was unreliable and no Google key is wanted.
- QR decoding uses the native BarcodeDetector when present and falls back to jsQR (`src/lib/qr.ts`). Why: iOS Safari and Firefox lack BarcodeDetector.

- Payment proof is submitted by the traveler to the private `payment-proofs` Storage bucket; only the `review_booking_payment` RPC (booking's business or admin) can approve or reject it. Why: payment fields are guarded by a trigger so no client can mark itself paid.
- Fawry "Pay at Fawry" codes are created and checked only on the server (`src/lib/fawry.functions.ts` + `fawry.server.ts`), written through service-role-only RPCs (`fawry_attach_voucher`, `fawry_apply_status`); the public webhook only looks up the booking and re-reads the status from Fawry's API. Why: callback bodies are never trusted.

- Demo traveler/business accounts are data rows, not migrations; no demo admin exists. Why: a public password must never unlock admin.
