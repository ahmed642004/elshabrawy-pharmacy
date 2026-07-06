"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MapPin, Package, Pencil, PlusCircle, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import IconButton from "@/components/ui/IconButton";
import { updateProfile, saveAddress, updateAddress, deleteAddress, setDefaultAddress } from "@/lib/actions";
import type { AccountData, AccountAddress } from "@/lib/queries";

interface AddressForm {
  recipient: string;
  phone: string;
  street: string;
  city: string;
}

const EMPTY_ADDRESS: AddressForm = { recipient: "", phone: "", street: "", city: "" };

function AddressFields({
  form,
  onChange,
  errors,
}: {
  form: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  errors: Partial<Record<keyof AddressForm, string>>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Input
            placeholder="Recipient name"
            value={form.recipient}
            onChange={(e) => onChange("recipient", e.target.value)}
          />
          {errors.recipient && <div className="mt-1 text-xs text-danger-500">{errors.recipient}</div>}
        </div>
        <div>
          <Input placeholder="Phone number" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} />
          {errors.phone && <div className="mt-1 text-xs text-danger-500">{errors.phone}</div>}
        </div>
      </div>
      <div>
        <Input
          placeholder="Street address, building, apartment"
          value={form.street}
          onChange={(e) => onChange("street", e.target.value)}
        />
        {errors.street && <div className="mt-1 text-xs text-danger-500">{errors.street}</div>}
      </div>
      <div>
        <Input placeholder="City / area" value={form.city} onChange={(e) => onChange("city", e.target.value)} />
        {errors.city && <div className="mt-1 text-xs text-danger-500">{errors.city}</div>}
      </div>
    </div>
  );
}

export default function AccountClient({ account }: { account: AccountData }) {
  const router = useRouter();

  const [fullName, setFullName] = useState(account.fullName);
  const [phone, setPhone] = useState(account.phone);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // null = no form open; "new" = adding; otherwise the id being edited.
  const [addressFormFor, setAddressFormFor] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [pendingAddressId, setPendingAddressId] = useState<string | null>(null);

  async function handleSaveProfile() {
    if (savingProfile) return;
    setSavingProfile(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      await updateProfile({ fullName, phone });
      setProfileSaved(true);
      router.refresh();
    } catch {
      setProfileError("Couldn't save your details. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  function openAddressForm(target: "new" | AccountAddress) {
    setAddressErrors({});
    if (target === "new") {
      setAddressFormFor("new");
      setAddressForm(EMPTY_ADDRESS);
    } else {
      setAddressFormFor(target.id);
      setAddressForm({ recipient: target.recipient, phone: target.phone, street: target.street, city: target.city });
    }
  }

  function validateAddress(): Partial<Record<keyof AddressForm, string>> {
    const errors: Partial<Record<keyof AddressForm, string>> = {};
    if (!addressForm.recipient.trim()) errors.recipient = "Recipient name is required";
    if (!addressForm.phone.trim()) errors.phone = "Phone number is required";
    if (!addressForm.street.trim()) errors.street = "Address is required";
    if (!addressForm.city.trim()) errors.city = "City / area is required";
    return errors;
  }

  async function handleSaveAddress() {
    if (savingAddress || !addressFormFor) return;
    const errors = validateAddress();
    if (Object.keys(errors).length) {
      setAddressErrors(errors);
      return;
    }
    setSavingAddress(true);
    try {
      if (addressFormFor === "new") await saveAddress(addressForm);
      else await updateAddress(addressFormFor, addressForm);
      setAddressFormFor(null);
      router.refresh();
    } catch {
      setAddressErrors({ city: "Couldn't save this address. Please try again." });
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleDelete(id: string) {
    setPendingAddressId(id);
    try {
      await deleteAddress(id);
      router.refresh();
    } finally {
      setPendingAddressId(null);
    }
  }

  async function handleSetDefault(id: string) {
    setPendingAddressId(id);
    try {
      await setDefaultAddress(id);
      router.refresh();
    } finally {
      setPendingAddressId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[20px] border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="m-0 mb-4 font-headline text-lg font-bold text-neutral-900">Profile</h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">Full name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">Email</label>
            <Input value={account.email} disabled className="bg-neutral-50 text-neutral-500" />
          </div>
          {profileError && (
            <div className="rounded-[10px] bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600">{profileError}</div>
          )}
          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" disabled={savingProfile} onClick={handleSaveProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
            {profileSaved && (
              <span className="flex items-center gap-1 text-sm font-semibold text-success-600">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 font-headline text-lg font-bold text-neutral-900">Saved addresses</h2>
          {addressFormFor !== "new" && (
            <button
              type="button"
              onClick={() => openAddressForm("new")}
              className="flex items-center gap-1.5 font-label text-sm font-semibold text-primary-600"
            >
              <PlusCircle className="h-4 w-4" /> Add address
            </button>
          )}
        </div>

        {account.addresses.length === 0 && addressFormFor !== "new" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MapPin className="h-7 w-7 text-neutral-300" />
            <div className="text-sm text-neutral-500">No saved addresses yet — add one to speed up checkout.</div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {account.addresses.map((address) => {
            const pending = pendingAddressId === address.id;
            const editingThis = addressFormFor === address.id;
            return (
              <div key={address.id} className="rounded-[14px] border border-neutral-200 p-4">
                {editingThis ? (
                  <div className="flex flex-col gap-3">
                    <AddressFields
                      form={addressForm}
                      onChange={(field, value) => setAddressForm((prev) => ({ ...prev, [field]: value }))}
                      errors={addressErrors}
                    />
                    <div className="flex gap-2.5">
                      <Button variant="outlined" size="sm" onClick={() => setAddressFormFor(null)}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" disabled={savingAddress} onClick={handleSaveAddress}>
                        {savingAddress ? "Saving…" : "Save address"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline text-sm font-bold text-neutral-900">{address.recipient}</span>
                        {address.isDefault && <Badge tone="primary">Default</Badge>}
                      </div>
                      <div className="mt-0.5 text-[13px] text-neutral-500">
                        {address.street}, {address.city}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-neutral-400">{address.phone}</div>
                      {!address.isDefault && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleSetDefault(address.id)}
                          className="mt-1.5 font-label text-[12.5px] font-semibold text-primary-600 disabled:opacity-50"
                        >
                          Set as default
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <IconButton
                        icon={Pencil}
                        aria-label={`Edit address for ${address.recipient}`}
                        size="sm"
                        disabled={pending}
                        onClick={() => openAddressForm(address)}
                      />
                      <IconButton
                        icon={Trash2}
                        aria-label={`Delete address for ${address.recipient}`}
                        size="sm"
                        tone="danger"
                        disabled={pending}
                        onClick={() => handleDelete(address.id)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {addressFormFor === "new" && (
            <div className="rounded-[14px] border border-dashed border-neutral-300 p-4">
              <div className="flex flex-col gap-3">
                <AddressFields
                  form={addressForm}
                  onChange={(field, value) => setAddressForm((prev) => ({ ...prev, [field]: value }))}
                  errors={addressErrors}
                />
                <div className="flex gap-2.5">
                  <Button variant="outlined" size="sm" onClick={() => setAddressFormFor(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" disabled={savingAddress} onClick={handleSaveAddress}>
                    {savingAddress ? "Saving…" : "Save address"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Link
        href="/account/orders"
        className="flex items-center justify-between rounded-[20px] border border-neutral-200 bg-white p-5 shadow-sm hover:bg-neutral-50"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tertiary-100">
            <Package className="h-5 w-5 text-primary-500" />
          </span>
          <div>
            <div className="font-headline text-sm font-bold text-neutral-900">My orders</div>
            <div className="text-[13px] text-neutral-500">Track deliveries and see past purchases</div>
          </div>
        </div>
      </Link>
    </div>
  );
}
