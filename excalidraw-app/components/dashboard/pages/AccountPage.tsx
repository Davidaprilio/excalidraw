import { useRef, useState } from "react";

import api from "../../../data/api";
import { loadAvatarImage } from "../../../data/avatar";
import { AvatarCropDialog } from "../AvatarCropDialog";
import { useAuth } from "../../../auth/AuthContext";
import { UserIcon } from "../icons";

import { Avatar, Button, PageHeader, useToast, Card } from "../ui";

import { SecuritySection } from "./SecuritySection";

import type { FormEvent, ReactNode } from "react";

const MIN_PASSWORD_LENGTH = 8;

export function AccountPage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // chosen image waiting in the crop dialog
  const [cropping, setCropping] = useState<ImageBitmap | null>(null);

  const choosePhoto = async (file: File) => {
    try {
      setCropping(await loadAvatarImage(file));
    } catch (err: any) {
      toast(err.message);
    }
  };

  const closeCrop = () => {
    cropping?.close();
    setCropping(null);
  };

  const uploadPhoto = async (dataUrl: string) => {
    const res = await api.uploadAvatar(dataUrl);
    updateUser(res.user);
    closeCrop();
    toast("Profile photo updated");
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      const res = await api.deleteAvatar();
      updateUser(res.user);
      toast("Profile photo removed");
    } catch (err: any) {
      toast(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const res = await api.updateProfile({ name: name.trim() });
      updateUser(res.user);
      toast("Profile updated");
    } catch (err: any) {
      toast(err.message);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (passwords.next.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `The new password needs at least ${MIN_PASSWORD_LENGTH} characters`,
      );
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError("The new passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      toast("Password changed. Other devices have been signed out.");
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<UserIcon className="h-6 w-6" />}
        title="Account settings"
        subtitle="Your profile, password and sign-in security."
      />
      <div className="grid max-w-6xl items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card title="Profile">
            <form onSubmit={saveProfile} className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Avatar
                  name={name || user?.email || "?"}
                  size="h-16 w-16 text-2xl"
                  src={user && api.avatarUrl(user.id, user.avatar_version)}
                />
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      disabled={photoBusy}
                      onClick={() => fileInput.current?.click()}
                    >
                      {user?.avatar_version ? "Change photo" : "Upload photo"}
                    </Button>
                    {user?.avatar_version && (
                      <Button
                        variant="ghost"
                        disabled={photoBusy}
                        onClick={removePhoto}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    JPG, PNG, WebP or GIF. You can crop it before saving.
                  </p>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      choosePhoto(file);
                    }
                  }}
                />
              </div>
              <Field label="Display name">
                <input
                  value={name}
                  maxLength={255}
                  onChange={(event) => setName(event.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Email">
                <input value={user?.email ?? ""} disabled className={INPUT} />
              </Field>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!name.trim() || name.trim() === user?.name}
                >
                  Save
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Change password">
            <form onSubmit={changePassword} className="flex flex-col gap-4">
              <Field label="Current password">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(event) =>
                    setPasswords({ ...passwords, current: event.target.value })
                  }
                  className={INPUT}
                />
              </Field>
              <Field label="New password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={(event) =>
                    setPasswords({ ...passwords, next: event.target.value })
                  }
                  className={INPUT}
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={(event) =>
                    setPasswords({ ...passwords, confirm: event.target.value })
                  }
                  className={INPUT}
                />
              </Field>
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
              <p className="text-sm text-gray-500">
                Other devices signed in to your account will be signed out.
              </p>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    busy ||
                    !passwords.current ||
                    !passwords.next ||
                    !passwords.confirm
                  }
                >
                  Change password
                </Button>
              </div>
            </form>
          </Card>
        </div>
        <section aria-label="Security" className="flex flex-col gap-6">
          <SecuritySection />
        </section>
      </div>
      {cropping && (
        <AvatarCropDialog
          image={cropping}
          onApply={uploadPhoto}
          onClose={closeCrop}
        />
      )}
    </>
  );
}

const INPUT =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50 disabled:text-gray-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
      {label}
      {children}
    </label>
  );
}
