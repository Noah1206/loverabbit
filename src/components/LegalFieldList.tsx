import type { LegalField } from "@/lib/business-info";

// 법정 기재사항을 항목-값 목록으로 찍는다. 값이 안 들어온 필수 항목은
// 조용히 빼지 않고 '미기재'로 남긴다 — 빠진 게 보여야 채우게 된다.
export default function LegalFieldList({ fields }: { fields: LegalField[] }) {
  return (
    <dl className="legal-dl">
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>
            {field.value ? (
              field.href ? (
                <a href={field.href}>{field.value}</a>
              ) : (
                field.value
              )
            ) : (
              <span className="legal-missing">미기재</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
