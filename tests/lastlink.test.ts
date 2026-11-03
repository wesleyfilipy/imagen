import { describe, expect, it } from "vitest";
import { parseLastlinkEvent } from "@/lib/lastlink";

const GEN_ID = "3f2b8c1e-6a4d-4c2b-9e1f-0a1b2c3d4e5f";

describe("parseLastlinkEvent", () => {
  it("reconhece um pagamento aprovado com comprador aninhado (formato PascalCase)", () => {
    const ev = parseLastlinkEvent({
      Id: "evt_123",
      IsTest: false,
      Event: "Purchase_Order_Confirmed",
      Data: {
        Buyer: { Email: "Maria@Email.com", Name: "Maria" },
        Purchase: { PaymentId: "pay_999", Price: { Value: 19.9 } },
        Utm: { UtmContent: GEN_ID },
      },
    });
    expect(ev.kind).toBe("approved");
    expect(ev.eventId).toBe("evt_123");
    expect(ev.email).toBe("maria@email.com");
    expect(ev.transactionId).toBe("pay_999");
    expect(ev.amountCents).toBe(1990);
    expect(ev.isTest).toBe(false);
    expect(ev.uuids).toContain(GEN_ID);
  });

  it("reconhece formato snake_case com status 'paid'", () => {
    const ev = parseLastlinkEvent({ id: 7, event: "order.paid", customer: { email: "a@b.co" }, amount: 1990 });
    expect(ev.kind).toBe("approved");
    expect(ev.amountCents).toBe(1990);
    expect(ev.eventId).toBe("7");
  });

  it("estorno/chargeback nunca é tratado como aprovado", () => {
    for (const event of ["Payment_Refund", "Payment_Chargeback", "Purchase_Canceled", "reembolso_confirmado"]) {
      expect(parseLastlinkEvent({ Event: event, Buyer: { Email: "a@b.co" } }).kind).toBe("refunded");
    }
  });

  it("pendente / aguardando pagamento não libera", () => {
    for (const event of ["Purchase_Request_Created", "pix_pending", "aguardando_pagamento", "payment_failed"]) {
      expect(parseLastlinkEvent({ Event: event, Buyer: { Email: "a@b.co" } }).kind).toBe("other");
    }
  });

  it("evento desconhecido não libera", () => {
    expect(parseLastlinkEvent({ Event: "Member_Joined", Buyer: { Email: "a@b.co" } }).kind).toBe("other");
  });

  it("com LASTLINK_APPROVED_EVENTS definido, só o nome exato aprova", () => {
    const opts = { approvedEvents: ["purchase_order_confirmed"], refundEvents: ["payment_refund"] };
    expect(parseLastlinkEvent({ Event: "Purchase_Order_Confirmed" }, opts).kind).toBe("approved");
    expect(parseLastlinkEvent({ Event: "Order_Paid" }, opts).kind).toBe("other");
    expect(parseLastlinkEvent({ Event: "Payment_Refund" }, opts).kind).toBe("refunded");
  });

  it("detecta eventos de teste", () => {
    expect(parseLastlinkEvent({ Event: "Purchase_Order_Confirmed", IsTest: true }).isTest).toBe(true);
  });

  it("prefere o e-mail do comprador ao de outros participantes", () => {
    const ev = parseLastlinkEvent({
      Event: "Purchase_Order_Confirmed",
      Data: { Seller: { Email: "loja@x.com" }, Buyer: { Email: "cliente@y.com" } },
    });
    expect(ev.email).toBe("cliente@y.com");
  });

  it("não quebra com payloads estranhos", () => {
    for (const p of [null, 42, "x", [], {}, { a: { b: { c: [1, 2, { d: null }] } } }]) {
      expect(parseLastlinkEvent(p).kind).toBe("other");
    }
  });
});
