"use client";
import { useActionState, useState } from "react";
import { buyPacksAction, grantPacksAction, updateProductAction } from "@/app/actions/game";
import { Field, FormAlert, SubmitButton } from "@/components/forms";

export function BuyForm({ productId, priceLabel, unitCents, currency, testMode }: { productId: string; priceLabel: string; unitCents: number; currency: string; testMode: boolean }) {
  const [state, action] = useActionState(buyPacksAction, undefined);
  const [qty, setQty] = useState(1);
  const total = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((unitCents * qty) / 100);
  return (
    <form action={action} className="stack" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="productId" value={productId} />
      <div className="row">
        <label className="tn-field__label" htmlFor={`qty-${productId}`}>Packs</label>
        <select id={`qty-${productId}`} name="quantity" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 90 }}>
          {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="muted small">{priceLabel} each</span>
      </div>
      <SubmitButton pendingText={testMode ? "Adding…" : "Opening checkout…"}>{testMode ? `Get ${qty} (test mode, free)` : `Buy ${qty} for ${total}`}</SubmitButton>
    </form>
  );
}

export function ProductForm({ p }: { p: { id: string; name: string; description: string; priceCents: number; active: boolean; odds: unknown; version: number } }) {
  const [state, action] = useActionState(updateProductAction, undefined);
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="version" value={p.version} />
      <Field name="name" label="Name" defaultValue={p.name} required state={state} />
      <Field name="description" label="Description" defaultValue={p.description} state={state} />
      <Field name="price" label="Price (USD)" defaultValue={(p.priceCents / 100).toFixed(2)} inputMode="decimal" required state={state} hint="Proposed launch price. Shown to buyers before checkout." />
      <label className="checkbox"><input type="checkbox" name="active" defaultChecked={p.active} /> <span>On sale</span></label>
      <Field name="odds" label="Odds (JSON)" textarea defaultValue={JSON.stringify(p.odds, null, 2)} state={state}
        hint="Slots with rarity weights, plus parallel weights. Packs already sold keep the odds they were sold with." />
      <SubmitButton>Save pack</SubmitButton>
    </form>
  );
}

export function GrantForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action] = useActionState(grantPacksAction, undefined);
  return (
    <form action={action} className="form-grid two card" noValidate>
      <div className="full"><FormAlert state={state} /></div>
      <Field name="email" label="Player email" type="email" required state={state} />
      <Field name="quantity" label="Packs" type="number" defaultValue={1} min={1} max={20} required state={state} />
      <Field name="productId" label="Pack" state={state}>
        {(id) => <select id={id} name="productId">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </Field>
      <div className="full"><SubmitButton pendingText="Giving…">Give free packs</SubmitButton></div>
    </form>
  );
}
