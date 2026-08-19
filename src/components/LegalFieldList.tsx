import type { LegalField } from "@/lib/business-info";

// 법정 기재사항을 항목-값 목록으로 찍는다. 값이 없는 항목은 애초에
// businessFields()/privacyOfficerFields()에서 걸러져 들어오지 않는다.
export default function LegalFieldList({ fields }: { fields: LegalField[] }) {
  if (fields.length === 0) return null;

  return (
    <dl className="legal-dl">
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.href ? <a href={field.href}>{field.value}</a> : field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
