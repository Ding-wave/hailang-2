type PaymentRecord = {
  planLabel: string;
  amount: string;
  paidAt: string;
};

export default function PaymentHistory({
  records,
}: {
  records: PaymentRecord[];
}) {
  if (records.length === 0) {
    return (
      <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
        暂无支付记录
      </p>
    );
  }

  return (
    <div
      className="mt-3 overflow-x-auto rounded-xl"
      style={{ border: "1px solid var(--card-border)" }}
    >
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr style={{ background: "var(--background)" }}>
            <th
              className="px-3 py-2.5 font-semibold"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--card-border)" }}
            >
              套餐
            </th>
            <th
              className="px-3 py-2.5 font-semibold"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--card-border)" }}
            >
              金额
            </th>
            <th
              className="px-3 py-2.5 font-semibold"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--card-border)" }}
            >
              支付时间
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr
              key={`${record.paidAt}-${record.planLabel}-${index}`}
              style={{
                background: index % 2 === 0 ? "var(--card-bg)" : "var(--background)",
              }}
            >
              <td
                className="px-3 py-2.5"
                style={{ color: "var(--foreground)", borderBottom: "1px solid var(--card-border)" }}
              >
                {record.planLabel}
              </td>
              <td
                className="px-3 py-2.5 whitespace-nowrap"
                style={{ color: "var(--foreground)", borderBottom: "1px solid var(--card-border)" }}
              >
                ¥{record.amount}
              </td>
              <td
                className="px-3 py-2.5 whitespace-nowrap"
                style={{ color: "var(--muted)", borderBottom: "1px solid var(--card-border)" }}
              >
                {record.paidAt}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
