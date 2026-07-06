import { PlusCircle, Truck } from "lucide-react";
import Input from "@/components/ui/Input";

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
}

export interface DeliveryForm {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

interface DeliveryStepProps {
  addresses: Address[];
  selectedAddressId: string | null;
  addingNew: boolean;
  form: DeliveryForm;
  errors: Partial<Record<keyof DeliveryForm, string>>;
  onSelectAddress: (id: string) => void;
  onSelectAddNew: () => void;
  onFormChange: (field: keyof DeliveryForm, value: string) => void;
}

export default function DeliveryStep({
  addresses,
  selectedAddressId,
  addingNew,
  form,
  errors,
  onSelectAddress,
  onSelectAddNew,
  onFormChange,
}: DeliveryStepProps) {
  const showEta = (!!selectedAddressId && !addingNew) || (addingNew && form.city.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 font-headline text-xl font-extrabold text-neutral-900">Delivery details</h2>

      <div className="flex flex-col gap-2.5">
        {addresses.map((a) => {
          const selected = !addingNew && selectedAddressId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelectAddress(a.id)}
              className={`flex w-full items-start gap-3 rounded-[14px] border px-4 py-3.5 text-left ${
                selected ? "border-2 border-primary-500 bg-primary-50" : "border-neutral-300 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full ${
                  selected ? "border-[5px] border-primary-500" : "border-[1.5px] border-neutral-300"
                } bg-white`}
              />
              <span>
                <span className="block font-headline text-sm font-bold text-neutral-900">
                  {a.label} — {a.name}
                </span>
                <span className="mt-0.5 block text-[13px] text-neutral-500">
                  {a.address}, {a.city}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-neutral-400">{a.phone}</span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onSelectAddNew}
          className={`flex w-full items-center gap-2 rounded-[14px] border px-4 py-3.5 text-left font-label text-[13.5px] font-semibold text-neutral-700 ${
            addingNew ? "border-2 border-primary-500 bg-primary-50" : "border-dashed border-neutral-300 bg-white"
          }`}
        >
          <PlusCircle className="h-[18px] w-[18px]" /> Add new address
        </button>
      </div>

      {addingNew && (
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-neutral-200 bg-white p-4.5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <Input
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => onFormChange("fullName", e.target.value)}
              />
              {errors.fullName && <div className="mt-1 text-xs text-danger-500">{errors.fullName}</div>}
            </div>
            <div>
              <Input placeholder="Phone number" value={form.phone} onChange={(e) => onFormChange("phone", e.target.value)} />
              {errors.phone && <div className="mt-1 text-xs text-danger-500">{errors.phone}</div>}
            </div>
          </div>
          <div>
            <Input
              placeholder="Street address, building, apartment"
              value={form.address}
              onChange={(e) => onFormChange("address", e.target.value)}
            />
            {errors.address && <div className="mt-1 text-xs text-danger-500">{errors.address}</div>}
          </div>
          <div>
            <Input placeholder="City / area" value={form.city} onChange={(e) => onFormChange("city", e.target.value)} />
            {errors.city && <div className="mt-1 text-xs text-danger-500">{errors.city}</div>}
          </div>
          <Input
            placeholder="Delivery notes (optional)"
            value={form.notes}
            onChange={(e) => onFormChange("notes", e.target.value)}
          />
        </div>
      )}

      {showEta && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-secondary-100 bg-secondary-50 px-3.5 py-3 text-[13.5px] text-neutral-700">
          <Truck className="h-[18px] w-[18px] shrink-0 text-secondary-600" /> Estimated delivery:{" "}
          <strong>within 2 hours</strong> of order confirmation
        </div>
      )}
    </div>
  );
}
