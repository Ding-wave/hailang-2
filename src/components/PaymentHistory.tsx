"use client";

import { useState } from "react";

interface PaymentRecord {
  amount: number;
  date: string;
  status: string;
}

export default function PaymentHistory({
  records,
}: {
  records: PaymentRecord[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
          支付记录
        </p>
        <button
          type="button"
          className="text-[13px]"
          style={{ color: "var(--gold)" }}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? "展开" : "收起"}
        </button>
      </div>

      {!collapsed && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--card-border)" }}
        >
          {records.map((p, i) => (
            <div
              key={`${p.date}-${p.amount}-${i}`}
              className="px-5 py-4 flex items-center justify-between"
              style={{
                background: i % 2 === 0 ? "var(--card-bg)" : "var(--background)",
                borderBottom:
                  i < records.length - 1 ? "1px solid var(--card-border)" : "none",
              }}
            >
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {p.amount} 元
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {p.date}
                </p>
              </div>
              <span
                className="text-[12px] font-semibold px-3 py-1 rounded-full"
                style={{
                  background: "var(--gold-light)",
                  color: "var(--gold)",
                  border: "1px solid var(--gold)",
                }}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
